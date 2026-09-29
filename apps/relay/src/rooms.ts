/**
 * The room registry — every pairing and forwarding rule, with no sockets in sight.
 *
 * A room is one TV and at most one phone, found by a 4-digit code shown on TV-3. The
 * registry is pure logic over a small `Conn` interface, so every rule here is unit-tested
 * without opening a port.
 *
 * Rules, all enforced here:
 *   - The display creates a room and is given its code. The sensor joins by that code.
 *   - One of each role per room. A second phone is refused, unless it holds the resume
 *     token of the seat it is reclaiming after a dropped connection.
 *   - Every message is decoded and validated. Each role may forward only its own message
 *     types (protocol.FORWARDABLE) — a phone cannot push a session, a TV cannot fake a frame.
 *   - Guessing codes is rate-limited per address. Four digits is a pairing convenience on a
 *     home network, not a password; the rate limit keeps it honest.
 *   - The TV's latest exercise and phase are cached and replayed to a phone that joins late,
 *     so it can start measuring immediately.
 *   - Silence past the heartbeat window is a lost connection; the peer is told "lost", which
 *     the TV treats as "carry on solo".
 */

import { protocol } from '@adapt/core';

export interface Conn {
  readonly id: string;
  /** Remote address, for rate-limiting code guesses. */
  readonly remote: string;
  send(text: string): void;
  close(code: number, reason: string): void;
}

type Role = protocol.Role;

interface Seat {
  conn: Conn | null;
  resume: string;
  lastSeen: number;
  goneAt: number | null;
}

interface Room {
  code: string;
  display: Seat | null;
  sensor: Seat | null;
  lastExercise: string | null;
  lastState: string | null;
  createdAt: number;
}

interface Binding {
  code: string;
  role: Role;
}

export type RegistryEvent =
  | { type: 'opened'; code: string }
  | { type: 'joined' | 'left' | 'lost'; code: string; role: Role }
  | { type: 'closed'; code: string };

export interface RegistryOptions {
  onEvent?: (event: RegistryEvent) => void;
  now?: () => number;
  /** Allocates a 4-digit code not currently in use. */
  newCode?: (inUse: (code: string) => boolean) => string;
  newToken?: () => string;
  /** No inbound traffic for this long and a connection is considered lost. */
  silenceMs?: number;
  /** How long a room survives its TV disconnecting, waiting for it to come back. */
  displayGraceMs?: number;
  maxRooms?: number;
  /** Wrong codes allowed per address inside `guessWindowMs`. */
  maxGuesses?: number;
  guessWindowMs?: number;
}

export interface RegistryStats {
  rooms: number;
  paired: number;
  dropped: number;
}

const other = (r: Role): Role => (r === 'display' ? 'sensor' : 'display');

function defaultCode(inUse: (code: string) => boolean): string {
  for (let i = 0; i < 10_000; i++) {
    // 1000–9999: no leading zero, so the code on TV-3 never reads as three digits.
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (!inUse(code)) return code;
  }
  throw new Error('No free pairing codes');
}

function defaultToken(): string {
  let t = '';
  while (t.length < 24) t += Math.random().toString(36).slice(2);
  return t.slice(0, 24);
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();
  private readonly bindings = new Map<string, Binding>();
  private readonly guesses = new Map<string, { count: number; since: number }>();
  private dropped = 0;

  private readonly onEvent: (event: RegistryEvent) => void;
  private readonly now: () => number;
  private readonly newCode: (inUse: (code: string) => boolean) => string;
  private readonly newToken: () => string;
  private readonly silenceMs: number;
  private readonly displayGraceMs: number;
  private readonly maxRooms: number;
  private readonly maxGuesses: number;
  private readonly guessWindowMs: number;

  constructor(opts: RegistryOptions = {}) {
    this.onEvent = opts.onEvent ?? (() => undefined);
    this.now = opts.now ?? (() => Date.now());
    this.newCode = opts.newCode ?? defaultCode;
    this.newToken = opts.newToken ?? defaultToken;
    this.silenceMs = opts.silenceMs ?? 12_000;
    this.displayGraceMs = opts.displayGraceMs ?? 120_000;
    this.maxRooms = opts.maxRooms ?? 500;
    this.maxGuesses = opts.maxGuesses ?? 5;
    this.guessWindowMs = opts.guessWindowMs ?? 60_000;
  }

  // ---------------------------------------------------------------------------
  // Inbound
  // ---------------------------------------------------------------------------

  /** Every text frame from a connection, before or after it has said hello. */
  receive(conn: Conn, raw: string): void {
    const decoded = protocol.decode(raw);
    const binding = this.bindings.get(conn.id);

    if (!binding) {
      if (!decoded.ok) {
        this.reject(conn, decoded.reason === 'version' ? 'version' : 'bad-hello');
        return;
      }
      if (decoded.message.type !== 'hello') {
        this.reject(conn, 'bad-hello');
        return;
      }
      this.hello(conn, decoded.message);
      return;
    }

    const room = this.rooms.get(binding.code);
    const seat = room?.[binding.role];
    if (!room || !seat || seat.conn?.id !== conn.id) return;
    seat.lastSeen = this.now();

    if (!decoded.ok) {
      this.dropped++;
      return;
    }
    const m = decoded.message;
    if (m.type === 'pong') return;
    if (!protocol.FORWARDABLE[binding.role].has(m.type)) {
      this.dropped++;
      return;
    }

    const text = protocol.encode(m); // re-encoded: only validated fields travel on
    if (m.type === 'session.exercise') room.lastExercise = text;
    if (m.type === 'session.state') room.lastState = text;

    const peer = room[other(binding.role)]?.conn;
    if (peer) peer.send(text);
  }

  /** The connection closed. `clean` = an intentional close rather than a network failure. */
  disconnect(conn: Conn, clean: boolean): void {
    const binding = this.bindings.get(conn.id);
    this.bindings.delete(conn.id);
    if (!binding) return;
    const room = this.rooms.get(binding.code);
    const seat = room?.[binding.role];
    if (!room || !seat || seat.conn?.id !== conn.id) return;

    seat.conn = null;
    seat.goneAt = this.now();
    this.onEvent({ type: clean ? 'left' : 'lost', code: room.code, role: binding.role });
    this.notifyPeer(room, binding.role, clean ? 'left' : 'lost');
  }

  // ---------------------------------------------------------------------------
  // Housekeeping — call every few seconds
  // ---------------------------------------------------------------------------

  /** Ping every live seat, drop silent ones, and expire rooms whose TV never came back. */
  sweep(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      for (const role of ['display', 'sensor'] as const) {
        const seat = room[role];
        const conn = seat?.conn;
        if (!seat || !conn) continue;
        if (now - seat.lastSeen > this.silenceMs) {
          conn.close(4001, 'silent');
          this.disconnect(conn, false);
        } else {
          conn.send(protocol.encode(protocol.make('ping', { t: now })));
        }
      }

      const display = room.display;
      if (display && !display.conn && display.goneAt !== null && now - display.goneAt > this.displayGraceMs) {
        room.sensor?.conn?.close(4404, 'room closed');
        if (room.sensor?.conn) this.bindings.delete(room.sensor.conn.id);
        this.rooms.delete(room.code);
        this.onEvent({ type: 'closed', code: room.code });
      }
    }
    for (const [addr, g] of this.guesses) if (now - g.since > this.guessWindowMs) this.guesses.delete(addr);
  }

  /** Whether this connection has completed its hello. */
  bound(conn: Conn): boolean {
    return this.bindings.has(conn.id);
  }

  stats(): RegistryStats {
    let paired = 0;
    for (const r of this.rooms.values()) if (r.display?.conn && r.sensor?.conn) paired++;
    return { rooms: this.rooms.size, paired, dropped: this.dropped };
  }

  // ---------------------------------------------------------------------------
  // Pairing
  // ---------------------------------------------------------------------------

  private hello(conn: Conn, h: protocol.MessageOf<'hello'>): void {
    if (h.role === 'display') return this.helloDisplay(conn, h);
    return this.helloSensor(conn, h);
  }

  private helloDisplay(conn: Conn, h: protocol.MessageOf<'hello'>): void {
    // A returning TV reclaims its room — and its code — with the resume token.
    if (h.resume) {
      for (const room of this.rooms.values()) {
        if (room.display?.resume === h.resume) {
          this.seat(conn, room, 'display', room.display.resume);
          return;
        }
      }
    }
    if (this.rooms.size >= this.maxRooms) return this.reject(conn, 'room-full');
    const code = this.newCode((c) => this.rooms.has(c));
    const room: Room = { code, display: null, sensor: null, lastExercise: null, lastState: null, createdAt: this.now() };
    this.rooms.set(code, room);
    this.onEvent({ type: 'opened', code });
    this.seat(conn, room, 'display', this.newToken());
  }

  private helloSensor(conn: Conn, h: protocol.MessageOf<'hello'>): void {
    const g = this.guesses.get(conn.remote);
    if (g && g.count >= this.maxGuesses && this.now() - g.since <= this.guessWindowMs) {
      return this.reject(conn, 'too-many-attempts');
    }

    const room = h.code ? this.rooms.get(h.code) : undefined;
    if (!room) {
      const cur = this.guesses.get(conn.remote);
      this.guesses.set(conn.remote, cur ? { count: cur.count + 1, since: cur.since } : { count: 1, since: this.now() });
      return this.reject(conn, 'unknown-code');
    }

    const seat = room.sensor;
    const reclaiming = !!seat && !!h.resume && seat.resume === h.resume;
    if (seat?.conn && !reclaiming) return this.reject(conn, 'role-taken');

    this.seat(conn, room, 'sensor', reclaiming && seat ? seat.resume : this.newToken());

    // Catch a late-joining phone up, so it can start measuring immediately.
    if (room.lastExercise) conn.send(room.lastExercise);
    if (room.lastState) conn.send(room.lastState);
  }

  private seat(conn: Conn, room: Room, role: Role, resume: string): void {
    const previous = room[role]?.conn;
    if (previous && previous.id !== conn.id) {
      this.bindings.delete(previous.id);
      previous.close(4002, 'replaced');
    }
    room[role] = { conn, resume, lastSeen: this.now(), goneAt: null };
    this.bindings.set(conn.id, { code: room.code, role });

    const peerPresent = !!room[other(role)]?.conn;
    this.onEvent({ type: 'joined', code: room.code, role });
    conn.send(protocol.encode(protocol.make('welcome', { role, code: room.code, resume, peerPresent })));
    this.notifyPeer(room, role, 'joined');
  }

  private notifyPeer(room: Room, role: Role, status: 'joined' | 'left' | 'lost'): void {
    const peer = room[other(role)]?.conn;
    if (peer) peer.send(protocol.encode(protocol.make('peer', { role, status })));
  }

  private reject(conn: Conn, reason: protocol.MessageOf<'rejected'>['reason']): void {
    conn.send(protocol.encode(protocol.make('rejected', { reason })));
    conn.close(4003, reason);
  }
}

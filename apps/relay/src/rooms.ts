// One TV and at most one phone per room. Pure logic over `Conn`, so every rule is testable without a port.
// Codes are a pairing convenience, not a password, so wrong guesses are rate-limited per address.

import { protocol } from '@adapt/core';

export interface Conn {
  readonly id: string;
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
  newCode?: (inUse: (code: string) => boolean) => string;
  newToken?: () => string;
  silenceMs?: number;
  /** How long a room waits for its TV to come back. */
  displayGraceMs?: number;
  maxRooms?: number;
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
    // No leading zero, so the code never reads as three digits.
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

    const text = protocol.encode(m);
    if (m.type === 'session.exercise') room.lastExercise = text;
    if (m.type === 'session.state') room.lastState = text;

    const peer = room[other(binding.role)]?.conn;
    if (peer) peer.send(text);
  }

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

  bound(conn: Conn): boolean {
    return this.bindings.has(conn.id);
  }

  stats(): RegistryStats {
    let paired = 0;
    for (const r of this.rooms.values()) if (r.display?.conn && r.sensor?.conn) paired++;
    return { rooms: this.rooms.size, paired, dropped: this.dropped };
  }

  private hello(conn: Conn, h: protocol.MessageOf<'hello'>): void {
    if (h.role === 'display') return this.helloDisplay(conn, h);
    return this.helloSensor(conn, h);
  }

  private helloDisplay(conn: Conn, h: protocol.MessageOf<'hello'>): void {
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

    // Replay so a late-joining phone can start measuring immediately.
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

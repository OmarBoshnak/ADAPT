// Shared by the TV, the phone and the dev tools. The WebSocket constructor is injected to keep this package platform-free.

import {
  encode,
  decode,
  make,
  type Message,
  type MessageType,
  type Payload,
  type Role,
} from './protocol.js';

export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type WebSocketConstructor = new (url: string) => WebSocketLike;

const OPEN = 1;

export type Connection = 'connecting' | 'open' | 'reconnecting' | 'rejected' | 'closed';
export type PeerState = 'absent' | 'present' | 'lost';

export interface RelayStatus {
  connection: Connection;
  code: string | null;
  peer: PeerState;
  attempt: number;
  rejectedReason: string | null;
}

export interface RelayClientOptions {
  url: string;
  role: Role;
  /** Sensor only; the display is assigned one. */
  code?: string;
  client: string;
  WebSocketImpl?: WebSocketConstructor;
  /** The relay pings every 5 s. */
  silenceTimeoutMs?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  /** Corrections are held this long across a reconnect; frames are never held. */
  correctionHoldMs?: number;
  random?: () => number;
  onMessage?: (message: Message) => void;
  onStatus?: (status: RelayStatus) => void;
}

const CONTROL: ReadonlySet<MessageType> = new Set(['hello', 'welcome', 'rejected', 'peer', 'ping', 'pong']);

interface ResolvedOptions extends Required<Omit<RelayClientOptions, 'code' | 'onMessage' | 'onStatus'>> {
  onMessage: ((message: Message) => void) | undefined;
  onStatus: ((status: RelayStatus) => void) | undefined;
}

export class RelayClient {
  private readonly opts: ResolvedOptions;
  private code: string | null;
  private socket: WebSocketLike | null = null;
  private resume: string | null = null;
  private attempt = 0;
  private stopped = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private held: Array<{ text: string; expires: number }> = [];
  private _status: RelayStatus;

  constructor(options: RelayClientOptions) {
    const WebSocketImpl = options.WebSocketImpl ?? (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
    if (!WebSocketImpl) throw new Error('No WebSocket implementation available on this platform');
    if (options.role === 'sensor' && !options.code) throw new Error('A sensor needs a pairing code to join');
    this.opts = {
      url: options.url,
      role: options.role,
      client: options.client,
      WebSocketImpl,
      silenceTimeoutMs: options.silenceTimeoutMs ?? 12_000,
      initialBackoffMs: options.initialBackoffMs ?? 500,
      maxBackoffMs: options.maxBackoffMs ?? 8_000,
      correctionHoldMs: options.correctionHoldMs ?? 3_000,
      random: options.random ?? Math.random,
      onMessage: options.onMessage,
      onStatus: options.onStatus,
    };
    this.code = options.code ?? null;
    this._status = { connection: 'closed', code: this.code, peer: 'absent', attempt: 0, rejectedReason: null };
  }

  get status(): RelayStatus {
    return this._status;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      s.close(1000, 'client stopped');
    }
    this.update({ connection: 'closed' });
  }

  /** Returns false if the message was dropped. */
  send<T extends MessageType>(type: T, payload: Payload<T>): boolean {
    const text = encode(make(type, payload));
    if (this.socket && this.socket.readyState === OPEN && this._status.connection === 'open') {
      this.socket.send(text);
      return true;
    }
    if (type === 'user.correction' || type === 'user.command') {
      this.held.push({ text, expires: Date.now() + this.opts.correctionHoldMs });
      return true;
    }
    return false;
  }

  private update(patch: Partial<RelayStatus>): void {
    this._status = { ...this._status, ...patch };
    this.opts.onStatus?.(this._status);
  }

  private clearTimers(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.silenceTimer = null;
    this.retryTimer = null;
  }

  private armSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      // The socket may not have noticed the link is gone.
      this.socket?.close(4000, 'silent');
      this.onDisconnect();
    }, this.opts.silenceTimeoutMs);
  }

  private connect(): void {
    if (this.stopped) return;
    this.update({ connection: this.attempt === 0 ? 'connecting' : 'reconnecting', attempt: this.attempt });

    let socket: WebSocketLike;
    try {
      socket = new this.opts.WebSocketImpl(this.opts.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      const hello: Payload<'hello'> = { role: this.opts.role, client: this.opts.client };
      if (this.code && this.opts.role === 'sensor') hello.code = this.code;
      if (this.resume) hello.resume = this.resume;
      socket.send(encode(make('hello', hello)));
      this.armSilenceTimer();
    };
    socket.onmessage = (ev) => this.onRaw(ev.data);
    socket.onerror = () => {
      // onclose follows
    };
    socket.onclose = () => {
      if (this.socket === socket) this.onDisconnect();
    };
  }

  private onDisconnect(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = null;
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onclose = null;
      s.onmessage = null;
    }
    if (this.stopped || this._status.connection === 'rejected') return;
    this.update({ peer: this._status.peer === 'present' ? 'lost' : this._status.peer });
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    const base = Math.min(this.opts.maxBackoffMs, this.opts.initialBackoffMs * 2 ** this.attempt);
    const delay = Math.round(base * (0.5 + this.opts.random() / 2));
    this.attempt++;
    this.update({ connection: 'reconnecting', attempt: this.attempt });
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private onRaw(data: unknown): void {
    if (typeof data !== 'string') return;
    const decoded = decode(data);
    if (!decoded.ok) return;
    this.armSilenceTimer();
    const m = decoded.message;

    switch (m.type) {
      case 'ping':
        this.socket?.send(encode(make('pong', { t: m.t })));
        return;
      case 'welcome':
        this.resume = m.resume;
        this.code = m.code;
        this.attempt = 0;
        this.update({
          connection: 'open',
          code: m.code,
          peer: m.peerPresent ? 'present' : this._status.peer === 'lost' ? 'lost' : 'absent',
          attempt: 0,
          rejectedReason: null,
        });
        this.flushHeld();
        return;
      case 'rejected':
        // An unknown code needs a person to re-enter it; retrying cannot help.
        this.update({ connection: 'rejected', rejectedReason: m.reason });
        this.clearTimers();
        this.socket?.close(1000, 'rejected');
        return;
      case 'peer':
        this.update({ peer: m.status === 'joined' ? 'present' : m.status === 'lost' ? 'lost' : 'absent' });
        this.opts.onMessage?.(m);
        return;
      default:
        if (!CONTROL.has(m.type)) this.opts.onMessage?.(m);
    }
  }

  private flushHeld(): void {
    const now = Date.now();
    const fresh = this.held.filter((h) => h.expires >= now);
    this.held = [];
    for (const h of fresh) this.socket?.send(h.text);
  }
}

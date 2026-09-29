import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { decode, encode, make, type Message } from './protocol.js';
import { RelayClient, type RelayStatus, type WebSocketLike } from './relay-client.js';

/** A controllable stand-in for the platform WebSocket. */
class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: Message[] = [];
  closed: { code?: number | undefined; reason?: string | undefined } | null = null;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code?: number; reason?: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    const d = decode(data);
    if (d.ok) this.sent.push(d.message);
  }
  close(code?: number, reason?: string) {
    this.closed = { code, reason };
    this.readyState = 3;
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  deliver(m: Message) {
    this.onmessage?.({ data: encode(m) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.({ code: 1006 });
  }
  static last(): FakeSocket {
    return FakeSocket.all[FakeSocket.all.length - 1] as FakeSocket;
  }
}

const welcome = (code = '4821', peerPresent = false) =>
  make('welcome', { role: 'display', code, resume: 'resume-token-1', peerPresent });

function client(extra: Partial<ConstructorParameters<typeof RelayClient>[0]> = {}) {
  const statuses: RelayStatus[] = [];
  const messages: Message[] = [];
  const c = new RelayClient({
    url: 'ws://relay/ws',
    role: 'display',
    client: 'test',
    WebSocketImpl: FakeSocket,
    random: () => 0.5,
    onStatus: (s) => statuses.push(s),
    onMessage: (m) => messages.push(m),
    ...extra,
  });
  return { c, statuses, messages };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('RelayClient — pairing', () => {
  it('says hello as a display and learns its code', () => {
    const { c } = client();
    c.start();
    const s = FakeSocket.last();
    s.open();
    expect(s.sent[0]).toMatchObject({ type: 'hello', role: 'display' });
    expect(s.sent[0]).not.toHaveProperty('code');
    s.deliver(welcome('4821'));
    expect(c.status).toMatchObject({ connection: 'open', code: '4821', peer: 'absent' });
  });

  it('joins by code as a sensor', () => {
    const { c } = client({ role: 'sensor', code: '4821' });
    c.start();
    FakeSocket.last().open();
    expect(FakeSocket.last().sent[0]).toMatchObject({ type: 'hello', role: 'sensor', code: '4821' });
  });

  it('refuses to construct a sensor with no code', () => {
    expect(() => client({ role: 'sensor' })).toThrow();
  });

  it('stops trying after being told the code is unknown — a person must fix that', () => {
    const { c } = client({ role: 'sensor', code: '0000' });
    c.start();
    FakeSocket.last().open();
    FakeSocket.last().deliver(make('rejected', { reason: 'unknown-code' }));
    expect(c.status).toMatchObject({ connection: 'rejected', rejectedReason: 'unknown-code' });
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe('RelayClient — traffic', () => {
  it('answers pings and hides control traffic from the app', () => {
    const { c, messages } = client();
    c.start();
    const s = FakeSocket.last();
    s.open();
    s.deliver(welcome());
    s.deliver(make('ping', { t: 42 }));
    expect(s.sent.at(-1)).toMatchObject({ type: 'pong', t: 42 });
    expect(messages).toEqual([]);
  });

  it('passes peer changes and session traffic up', () => {
    const { c, messages } = client({ role: 'sensor', code: '4821' });
    c.start();
    const s = FakeSocket.last();
    s.open();
    s.deliver(welcome());
    s.deliver(make('peer', { role: 'display', status: 'joined' }));
    s.deliver(make('session.state', { seq: 1, phase: 'active' }));
    expect(messages.map((m) => m.type)).toEqual(['peer', 'session.state']);
    expect(c.status.peer).toBe('present');
  });

  it('ignores garbage on the wire', () => {
    const { c, messages } = client();
    c.start();
    const s = FakeSocket.last();
    s.open();
    s.onmessage?.({ data: '{nope' });
    s.onmessage?.({ data: 42 });
    expect(messages).toEqual([]);
  });

  it('drops frames while disconnected but holds corrections and commands briefly', () => {
    const { c } = client({ role: 'sensor', code: '4821' });
    c.start();
    expect(c.send('sensor.frame', { seq: 1, t: 0, quality: 1, cadence: null, confidence: 1, profile: 'impact' })).toBe(false);
    expect(c.send('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' })).toBe(true);
    expect(c.send('user.command', { command: 'pause', source: 'voice', heard: 'pause' })).toBe(true);
    const s = FakeSocket.last();
    s.open();
    s.deliver(welcome());
    expect(s.sent.map((m) => m.type)).toEqual(['hello', 'user.correction', 'user.command']);
  });

  it('lets a held correction expire rather than apply it late', () => {
    const { c } = client({ role: 'sensor', code: '4821', correctionHoldMs: 1000 });
    c.start();
    c.send('user.correction', { direction: 'easier', source: 'button' });
    vi.advanceTimersByTime(2000);
    const s = FakeSocket.last();
    s.open();
    s.deliver(welcome());
    expect(s.sent.map((m) => m.type)).toEqual(['hello']);
  });
});

describe('RelayClient — resilience', () => {
  it('reconnects with backoff and reclaims its seat with the resume token', () => {
    const { c } = client();
    c.start();
    FakeSocket.last().open();
    FakeSocket.last().deliver(welcome('4821', true));
    FakeSocket.last().drop();
    expect(c.status).toMatchObject({ connection: 'reconnecting', peer: 'lost' });

    vi.advanceTimersByTime(250); // initial 500 ms × jitter 0.75 = 375 ms — not yet
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(FakeSocket.all).toHaveLength(2);

    const s = FakeSocket.last();
    s.open();
    expect(s.sent[0]).toMatchObject({ type: 'hello', resume: 'resume-token-1' });
  });

  it('backs off exponentially, capped', () => {
    const { c } = client({ initialBackoffMs: 100, maxBackoffMs: 400 });
    c.start();
    const delays: number[] = [];
    let t = 0;
    for (let i = 0; i < 5; i++) {
      FakeSocket.last().drop();
      const before = FakeSocket.all.length;
      let waited = 0;
      while (FakeSocket.all.length === before) {
        vi.advanceTimersByTime(5);
        waited += 5;
      }
      delays.push(waited);
      t += waited;
    }
    expect(delays[1]).toBeGreaterThan(delays[0] as number);
    expect(Math.max(...delays)).toBeLessThanOrEqual(300 + 5); // 400 × 0.75
    expect(t).toBeGreaterThan(0);
  });

  it('treats silence as a dead link even if the socket has not noticed', () => {
    const { c } = client({ silenceTimeoutMs: 1000 });
    c.start();
    FakeSocket.last().open();
    FakeSocket.last().deliver(welcome());
    vi.advanceTimersByTime(1001);
    expect(FakeSocket.all[0]?.closed?.code).toBe(4000);
    expect(c.status.connection).toBe('reconnecting');
  });

  it('stops for good when asked', () => {
    const { c } = client();
    c.start();
    FakeSocket.last().open();
    c.stop();
    expect(c.status.connection).toBe('closed');
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('retries if the platform refuses to even construct a socket', () => {
    let calls = 0;
    class Exploding extends FakeSocket {
      constructor(url: string) {
        super(url);
        if (++calls === 1) throw new Error('no network');
      }
    }
    const { c } = client({ WebSocketImpl: Exploding });
    c.start();
    expect(c.status.connection).toBe('reconnecting');
    vi.advanceTimersByTime(1000);
    expect(calls).toBe(2);
  });
});

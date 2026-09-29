import { beforeEach, describe, expect, it } from 'vitest';

import { protocol } from '@adapt/core';

import { RoomRegistry, type Conn } from './rooms.js';

class FakeConn implements Conn {
  static n = 0;
  readonly id = `c${++FakeConn.n}`;
  inbox: protocol.Message[] = [];
  closed: { code: number; reason: string } | null = null;
  constructor(readonly remote = '10.0.0.1') {}
  send(text: string) {
    const d = protocol.decode(text);
    if (d.ok) this.inbox.push(d.message);
  }
  close(code: number, reason: string) {
    this.closed = { code, reason };
  }
  last() {
    return this.inbox[this.inbox.length - 1];
  }
  types() {
    return this.inbox.map((m) => m.type);
  }
}

let clock = 0;
let codes: string[] = [];
let tokens = 0;

function registry(opts: ConstructorParameters<typeof RoomRegistry>[0] = {}) {
  return new RoomRegistry({
    now: () => clock,
    newCode: () => codes.shift() ?? '4821',
    newToken: () => `token-${++tokens}-xxxxxxxx`,
    ...opts,
  });
}

const say = (r: RoomRegistry, c: FakeConn, m: protocol.Message) => r.receive(c, protocol.encode(m));
const hello = (role: 'display' | 'sensor', extra: { code?: string; resume?: string } = {}) =>
  protocol.make('hello', { role, client: 'test', ...extra });

/** A paired room: a TV and a phone, both welcomed. */
function paired(r: RoomRegistry) {
  const tv = new FakeConn();
  const phone = new FakeConn('10.0.0.2');
  say(r, tv, hello('display'));
  say(r, phone, hello('sensor', { code: '4821' }));
  return { tv, phone };
}

beforeEach(() => {
  clock = 0;
  codes = [];
  tokens = 0;
});

describe('pairing', () => {
  it('gives the TV a room and a code', () => {
    const r = registry();
    const tv = new FakeConn();
    say(r, tv, hello('display'));
    expect(tv.last()).toMatchObject({ type: 'welcome', role: 'display', code: '4821', peerPresent: false });
    expect(r.stats().rooms).toBe(1);
  });

  it('seats the phone by code and tells both sides', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    expect(phone.last()).toMatchObject({ type: 'welcome', role: 'sensor', peerPresent: true });
    expect(tv.last()).toMatchObject({ type: 'peer', role: 'sensor', status: 'joined' });
    expect(r.stats().paired).toBe(1);
  });

  it('refuses a second phone', () => {
    const r = registry();
    paired(r);
    const intruder = new FakeConn('10.0.0.9');
    say(r, intruder, hello('sensor', { code: '4821' }));
    expect(intruder.last()).toMatchObject({ type: 'rejected', reason: 'role-taken' });
    expect(intruder.closed?.code).toBe(4003);
  });

  it('refuses an unknown code', () => {
    const r = registry();
    const phone = new FakeConn();
    say(r, phone, hello('sensor', { code: '1234' }));
    expect(phone.last()).toMatchObject({ type: 'rejected', reason: 'unknown-code' });
  });

  it('rate-limits code guessing per address', () => {
    const r = registry({ maxGuesses: 3 });
    for (let i = 0; i < 3; i++) say(r, new FakeConn('6.6.6.6'), hello('sensor', { code: '1111' }));
    const fourth = new FakeConn('6.6.6.6');
    say(r, fourth, hello('sensor', { code: '4821' }));
    expect(fourth.last()).toMatchObject({ type: 'rejected', reason: 'too-many-attempts' });
    // a different address is unaffected
    const tv = new FakeConn();
    say(r, tv, hello('display'));
    const honest = new FakeConn('10.0.0.5');
    say(r, honest, hello('sensor', { code: '4821' }));
    expect(honest.last()?.type).toBe('welcome');
  });

  it('forgets old guesses after the window', () => {
    const r = registry({ maxGuesses: 1, guessWindowMs: 1000 });
    say(r, new FakeConn('6.6.6.6'), hello('sensor', { code: '1111' }));
    clock = 2000;
    r.sweep();
    const tv = new FakeConn();
    say(r, tv, hello('display'));
    const retry = new FakeConn('6.6.6.6');
    say(r, retry, hello('sensor', { code: '4821' }));
    expect(retry.last()?.type).toBe('welcome');
  });

  it('refuses anything before hello, and bad versions', () => {
    const r = registry();
    const c = new FakeConn();
    say(r, c, protocol.make('sensor.status', { onFloor: true }));
    expect(c.last()).toMatchObject({ type: 'rejected', reason: 'bad-hello' });
    const d = new FakeConn();
    r.receive(d, JSON.stringify({ v: 99, type: 'hello', role: 'display', client: 'x' }));
    expect(d.last()).toMatchObject({ type: 'rejected', reason: 'version' });
    const e = new FakeConn();
    r.receive(e, 'garbage');
    expect(e.last()).toMatchObject({ type: 'rejected', reason: 'bad-hello' });
  });

  it('caps the number of rooms', () => {
    const r = registry({ maxRooms: 1 });
    codes = ['1111', '2222'];
    say(r, new FakeConn(), hello('display'));
    const second = new FakeConn();
    say(r, second, hello('display'));
    expect(second.last()).toMatchObject({ type: 'rejected', reason: 'room-full' });
  });
});

describe('forwarding', () => {
  it('carries each role’s messages to the other', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    say(r, tv, protocol.make('session.state', { seq: 1, phase: 'active' }));
    say(r, phone, protocol.make('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' }));
    expect(phone.last()).toMatchObject({ type: 'session.state', phase: 'active' });
    expect(tv.last()).toMatchObject({ type: 'user.correction', heard: 'easier' });
  });

  it('refuses to let a role send the other role’s messages', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    const before = tv.inbox.length;
    say(r, phone, protocol.make('session.exercise', { seq: 9, exerciseId: 'x', name: 'x', signalProfile: 'impact', expectedCadence: null, durationSec: 1 }));
    say(r, tv, protocol.make('sensor.frame', { seq: 1, t: 0, quality: 1, cadence: null, confidence: 1, profile: 'impact' }));
    expect(tv.inbox.length).toBe(before);
    expect(phone.types()).not.toContain('sensor.frame');
    expect(r.stats().dropped).toBe(2);
  });

  it('drops malformed traffic from a seated client', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    const before = tv.inbox.length;
    r.receive(phone, '{"v":1,"type":"sensor.frame","quality":7}');
    expect(tv.inbox.length).toBe(before);
    expect(r.stats().dropped).toBe(1);
  });

  it('catches a late phone up with the TV’s latest exercise and phase', () => {
    const r = registry();
    const tv = new FakeConn();
    say(r, tv, hello('display'));
    say(r, tv, protocol.make('session.exercise', { seq: 4, exerciseId: 'adapt_jumping_jacks', name: 'Jumping Jacks', signalProfile: 'impact', expectedCadence: 70, durationSec: 60 }));
    say(r, tv, protocol.make('session.state', { seq: 4, phase: 'active' }));
    const phone = new FakeConn();
    say(r, phone, hello('sensor', { code: '4821' }));
    expect(phone.types()).toEqual(['welcome', 'session.exercise', 'session.state']);
  });
});

describe('events', () => {
  it('reports rooms opening, peers joining and leaving', () => {
    const events: string[] = [];
    const r = registry({ onEvent: (e) => events.push('role' in e ? `${e.type}:${e.role}` : e.type) });
    const { phone } = paired(r);
    r.disconnect(phone, false);
    expect(events).toEqual(['opened', 'joined:display', 'joined:sensor', 'lost:sensor']);
  });
});

describe('connections coming and going', () => {
  it('tells the TV "left" on a clean close and "lost" on a dropped one', () => {
    const clean = registry();
    const a = paired(clean);
    clean.disconnect(a.phone, true);
    expect(a.tv.last()).toMatchObject({ type: 'peer', role: 'sensor', status: 'left' });

    const dropped = registry();
    const b = paired(dropped);
    dropped.disconnect(b.phone, false);
    expect(b.tv.last()).toMatchObject({ type: 'peer', role: 'sensor', status: 'lost' });
  });

  it('reports a silent phone as lost after the heartbeat window, and pings the living', () => {
    const r = registry({ silenceMs: 10_000 });
    const { tv, phone } = paired(r);
    clock = 5_000;
    say(r, tv, protocol.make('pong', { t: 1 }));
    clock = 11_000;
    r.sweep();
    expect(phone.closed?.code).toBe(4001);
    expect(tv.last()).toMatchObject({ type: 'peer', role: 'sensor', status: 'lost' });
    clock = 12_000;
    r.sweep();
    expect(tv.last()?.type).toBe('ping');
  });

  it('lets a dropped phone reclaim its seat with its resume token', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    const token = (phone.inbox[0] as protocol.MessageOf<'welcome'>).resume;
    r.disconnect(phone, false);
    const back = new FakeConn('10.0.0.2');
    say(r, back, hello('sensor', { code: '4821', resume: token }));
    expect(back.last()?.type).toBe('welcome');
    expect(tv.last()).toMatchObject({ type: 'peer', status: 'joined' });
  });

  it('lets a resume token replace a half-dead connection that has not closed yet', () => {
    const r = registry();
    const { phone } = paired(r);
    const token = (phone.inbox[0] as protocol.MessageOf<'welcome'>).resume;
    const back = new FakeConn('10.0.0.2');
    say(r, back, hello('sensor', { code: '4821', resume: token }));
    expect(phone.closed?.code).toBe(4002);
    expect(back.last()?.type).toBe('welcome');
    // the old socket's close event, arriving late, must not unseat the new one
    r.disconnect(phone, false);
    expect(r.stats().paired).toBe(1);
  });

  it('gives a returning TV the same room and code', () => {
    const r = registry();
    const { tv, phone } = paired(r);
    const token = (tv.inbox[0] as protocol.MessageOf<'welcome'>).resume;
    r.disconnect(tv, false);
    expect(phone.last()).toMatchObject({ type: 'peer', role: 'display', status: 'lost' });
    const tv2 = new FakeConn();
    say(r, tv2, hello('display', { resume: token }));
    expect(tv2.last()).toMatchObject({ type: 'welcome', code: '4821', peerPresent: true });
  });

  it('closes a room whose TV never comes back, and tells the phone', () => {
    const r = registry({ displayGraceMs: 60_000 });
    const { tv, phone } = paired(r);
    r.disconnect(tv, false);
    clock = 61_000;
    say(r, phone, protocol.make('pong', { t: 1 })); // phone is alive; the room still goes
    r.sweep();
    expect(phone.closed?.code).toBe(4404);
    expect(r.stats().rooms).toBe(0);
  });

  it('ignores traffic and closes from connections it does not know', () => {
    const r = registry();
    const stranger = new FakeConn();
    r.disconnect(stranger, false);
    expect(r.stats().rooms).toBe(0);
  });
});

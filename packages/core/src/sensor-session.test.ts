import { beforeEach, describe, expect, it } from 'vitest';

import { make, type MessageOf, type MessageType, type Payload } from './protocol.js';
import { SensorSession } from './sensor-session.js';
import { BASELINE_SEC } from './signal.js';
import { synthesizeTrace } from './synth.js';

let sent: Array<{ type: MessageType; payload: unknown }> = [];
let t = 0;

function session() {
  return new SensorSession({
    send: <T extends MessageType>(type: T, payload: Payload<T>) => {
      sent.push({ type, payload });
      return true;
    },
  });
}

const exercise = (seq: number, name = 'Jumping Jacks') =>
  make('session.exercise', { seq, exerciseId: name, name, signalProfile: 'impact', expectedCadence: 70, durationSec: 60 });
const state = (seq: number, phase: MessageOf<'session.state'>['phase']) => make('session.state', { seq, phase });

function jump(s: SensorSession, sec: number) {
  const trace = synthesizeTrace({ profile: 'impact', durationSec: sec, cadencePerMin: 70, startT: t, seed: Math.round(t) + 1 });
  trace.forEach((x) => s.push(x));
  t += sec;
}

const frames = () => sent.filter((m) => m.type === 'sensor.frame').map((m) => m.payload as Payload<'sensor.frame'>);

beforeEach(() => {
  sent = [];
  t = 0;
});

describe('SensorSession', () => {
  it('measures only while the TV is working, twice a second, stamped with the current seq', () => {
    const s = session();
    s.receive(state(0, 'getready'));
    jump(s, 5);
    expect(frames()).toHaveLength(0);

    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    jump(s, 10);
    expect(frames()).toHaveLength(10 * 2);
    expect(new Set(frames().map((f) => f.seq))).toEqual(new Set([1]));

    s.receive(state(1, 'rest'));
    jump(s, 5);
    expect(frames()).toHaveLength(20);
  });

  it('keeps its baseline when the same movement is announced again after a reconnect', () => {
    const s = session();
    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    jump(s, BASELINE_SEC + 2);
    s.receive(exercise(1));
    jump(s, 1);
    expect(frames().at(-1)?.confidence).toBe(1);
  });

  it('re-baselines when the movement changes', () => {
    const s = session();
    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    jump(s, BASELINE_SEC + 2);
    s.receive(exercise(2, 'Step Jacks'));
    jump(s, 1);
    expect(frames().at(-1)).toMatchObject({ seq: 2, confidence: 0 });
    expect(s.snapshot.exercise?.name).toBe('Step Jacks');
    expect(s.snapshot.trace.every((q) => q === null)).toBe(true);
  });

  it('accepts a new session that reuses a seq once the last one has finished', () => {
    const s = session();
    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    s.receive(state(1, 'complete'));
    expect(s.snapshot.exercise).toBeNull();
    s.receive(state(0, 'getready'));
    s.receive(exercise(1, 'High Knees'));
    expect(s.snapshot.exercise?.name).toBe('High Knees');
  });

  it('tells the TV when it settles on the floor', () => {
    const s = session();
    jump(s, 2);
    expect(s.snapshot.onFloor).toBe(true);
    expect(sent).toContainEqual({ type: 'sensor.status', payload: { onFloor: true } });
  });

  it('shows what the TV switched to, and goes idle when the TV leaves', () => {
    const s = session();
    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    s.receive(make('session.adapted', { seq: 1, from: 'Jumping Jacks', to: 'Step Jacks', trigger: 'predicted-strain', reason: 'x' }));
    expect(s.snapshot.adapted).toEqual({ from: 'Jumping Jacks', to: 'Step Jacks' });
    s.receive(make('peer', { role: 'display', status: 'lost' }));
    expect(s.snapshot).toMatchObject({ phase: 'idle', exercise: null, adapted: null });
    expect(s.measuring).toBe(false);
  });

  it('notifies subscribers as frames arrive', () => {
    const s = session();
    let seen = 0;
    const off = s.subscribe(() => seen++);
    s.receive(exercise(1));
    s.receive(state(1, 'active'));
    const before = seen;
    jump(s, 2);
    expect(seen - before).toBeGreaterThanOrEqual(4);
    off();
  });
});

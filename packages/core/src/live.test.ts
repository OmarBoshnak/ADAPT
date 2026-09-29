import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import { LiveSession } from './live.js';
import { make, type MessageType, type Payload } from './protocol.js';
import type { SessionPlan } from './types.js';

const graph = fixtureGraph();

function plan(ids: string[], durationSec = 60, restSec = 10): SessionPlan {
  return {
    id: 'p',
    title: 'Test',
    segments: ids.map((exerciseId) => ({ exerciseId, durationSec, targetReps: 10 })),
    restSec,
    getReadySec: 8,
    totalDurationSec: ids.length * durationSec + (ids.length - 1) * restSec,
    exclusionLabels: [],
    generatedLocally: true,
    seed: 1,
  };
}

let clock = 0;
let sent: Array<{ type: MessageType; payload: unknown }> = [];

function live(ids = ['jacks', 'march'], opts: { bias?: number } = {}) {
  const l = new LiveSession({
    ctx: { graph, profile: fixtureProfile({ personalBias: opts.bias ?? 1 }), energy: 'medium' },
    plan: plan(ids),
    now: () => clock,
    send: <T extends MessageType>(type: T, payload: Payload<T>) => {
      sent.push({ type, payload });
      return true;
    },
  });
  return l;
}

/** Advance the injected clock and tick, as the interval would. */
function advance(l: LiveSession, seconds: number, stepMs = 250) {
  for (let t = 0; t < seconds * 1000; t += stepMs) {
    clock += stepMs;
    l.tick();
  }
}

const frame = (seq: number, quality = 0.9, confidence = 1) =>
  make('sensor.frame', { seq, t: clock / 1000, quality, cadence: 70, confidence, profile: 'impact' });

beforeEach(() => {
  clock = 0;
  sent = [];
});

describe('LiveSession — running solo', () => {
  it('runs a whole session on the TV alone', () => {
    const l = live();
    l.start();
    advance(l, 8 + 60 + 10 + 61);
    l.stop();
    expect(l.snapshot.state.phase).toBe('complete');
    expect(l.snapshot.mode).toBe('solo');
  });

  it('never fast-forwards after the app was backgrounded', () => {
    const l = live();
    l.start();
    clock += 60_000;
    l.tick();
    expect(l.snapshot.state.phase).toBe('getready'); // one step of at most 1 s
  });

  it('does not count paused time', () => {
    const l = live();
    l.start();
    advance(l, 10);
    const elapsed = l.snapshot.state.sessionElapsedSec;
    l.pause();
    clock += 30_000;
    l.tick();
    l.resume();
    advance(l, 1);
    expect(l.snapshot.state.sessionElapsedSec).toBeCloseTo(elapsed + 1, 1);
    expect(sent.some((m) => m.type === 'session.state' && (m.payload as { phase: string }).phase === 'paused')).toBe(true);
  });
});

describe('LiveSession — announcing to the phone', () => {
  it('announces each new movement with a fresh seq', () => {
    const l = live();
    l.start();
    advance(l, 8 + 1);
    const ex = sent.filter((m) => m.type === 'session.exercise');
    expect(ex).toHaveLength(1);
    expect(ex[0]?.payload).toMatchObject({ seq: 1, exerciseId: 'jacks', signalProfile: 'impact' });
    advance(l, 60 + 10 + 1);
    expect(sent.filter((m) => m.type === 'session.exercise').map((m) => (m.payload as { seq: number }).seq)).toEqual([1, 2]);
  });

  it('announces phase changes', () => {
    const l = live();
    l.start();
    advance(l, 9);
    const phases = sent.filter((m) => m.type === 'session.state').map((m) => (m.payload as { phase: string }).phase);
    expect(phases).toEqual(['getready', 'active']);
  });

  it('announces an adaptation, then the new movement once it starts', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.setPeer('present');
    l.receive(make('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' }));
    expect(sent.at(-2)?.type).toBe('session.adapted');
    advance(l, 3.5);
    expect(sent.filter((m) => m.type === 'session.exercise').at(-1)?.payload).toMatchObject({ seq: 2, exerciseId: 'step_jacks' });
  });

  it('catches a phone up when it joins mid-session', () => {
    const l = live();
    l.start();
    advance(l, 12);
    sent = [];
    l.setPeer('present');
    expect(sent.map((m) => m.type)).toEqual(['session.exercise', 'session.state']);
  });
});

describe('LiveSession — skipping', () => {
  it('ends the current movement, but not while paused', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.pause();
    l.skip();
    expect(l.snapshot.state.phase).toBe('active');
    l.resume();
    l.skip();
    expect(l.snapshot.state.phase).toBe('rest');
  });
});

describe('LiveSession — swapping', () => {
  it('announces the swapped movement to the phone with a fresh seq', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.swap('march');
    expect(l.snapshot.state.currentExerciseId).toBe('march');
    expect(sent.filter((m) => m.type === 'session.exercise').at(-1)?.payload).toMatchObject({ seq: 2, exerciseId: 'march' });
  });
});

describe('LiveSession — listening to the phone', () => {
  it('feeds current frames to the model and drops stale ones', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.setPeer('present');
    l.receive(frame(0, 0.2)); // wrong seq — from before this movement
    expect(l.snapshot.state.quality).toBeNull();
    l.receive(frame(1, 0.7));
    expect(l.snapshot.state.quality).toBeCloseTo(0.7, 5);
  });

  it('surfaces the spoken word for TV-8, and not a pressed button', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.correct('easier', 'button');
    expect(l.snapshot.heard).toBeNull();
    advance(l, 4);
    l.receive(make('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' }));
    expect(l.snapshot.heard).toEqual({ word: 'easier', atMs: clock });
  });

  it('ignores corrections outside a working segment', () => {
    const l = live();
    l.start();
    l.receive(make('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' }));
    expect(l.snapshot.state.corrections).toHaveLength(0);
    expect(l.snapshot.heard).toBeNull();
  });

  it('pauses and resumes on a command from the phone', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.receive(make('user.command', { command: 'pause', source: 'voice', heard: 'pause' }));
    expect(l.snapshot.paused).toBe(true);
    expect(sent.at(-1)).toMatchObject({ type: 'session.state', payload: { phase: 'paused' } });
    l.receive(make('user.command', { command: 'resume', source: 'button' }));
    expect(l.snapshot.paused).toBe(false);
  });

  it('swaps to a different movement on "swap this" without learning anything', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.receive(make('user.command', { command: 'swap', source: 'voice', heard: 'swap this' }));
    expect(l.snapshot.state.currentExerciseId).toBe('march');
    expect(l.snapshot.state.corrections).toHaveLength(0);
    expect(l.snapshot.state.learning).toHaveLength(0);
  });

  it('ignores "swap this" outside a working segment', () => {
    const l = live();
    l.start();
    l.receive(make('user.command', { command: 'swap', source: 'voice', heard: 'swap this' }));
    expect(l.snapshot.state.currentExerciseId).toBe('jacks');
  });

  it('tracks whether the phone is on the floor', () => {
    const l = live();
    l.setPeer('present');
    l.receive(make('sensor.status', { onFloor: true }));
    expect(l.snapshot.onFloor).toBe(true);
    l.setPeer('lost');
    expect(l.snapshot.onFloor).toBeNull();
  });
});

describe('LiveSession — the phone going away', () => {
  it('falls back to solo and discards the last reading when the relay reports it lost', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.receive(make('peer', { role: 'sensor', status: 'joined' }));
    l.receive(frame(1, 0.4));
    expect(l.snapshot.state.quality).not.toBeNull();
    l.receive(make('peer', { role: 'sensor', status: 'lost' }));
    expect(l.snapshot.mode).toBe('solo');
    expect(l.snapshot.state.quality).toBeNull();
    expect(l.snapshot.state.phase).toBe('active'); // the session did not stop
  });

  it('notices a phone that has gone quiet before the relay does', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.setPeer('present');
    l.receive(frame(1, 0.4));
    advance(l, 4); // > 3 s with no frames
    expect(l.snapshot.state.quality).toBeNull();
    expect(l.snapshot.mode).toBe('paired'); // still connected — just not trusted
  });

  it('ignores peer messages about itself', () => {
    const l = live();
    l.receive(make('peer', { role: 'display', status: 'joined' }));
    expect(l.snapshot.mode).toBe('solo');
  });
});

describe('LiveSession — closing', () => {
  it('tells the phone when the session is left early', () => {
    const l = live();
    l.start();
    advance(l, 9);
    l.close();
    expect(sent.at(-1)).toMatchObject({ type: 'session.state', payload: { phase: 'idle' } });
  });

  it('adds nothing after a session that finished', () => {
    const l = live();
    l.start();
    advance(l, 8 + 60 + 10 + 61);
    const count = sent.length;
    l.close();
    expect(sent).toHaveLength(count);
  });
});

describe('LiveSession — plumbing', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drives itself from an interval and stops at the end', () => {
    const l = new LiveSession({
      ctx: { graph, profile: fixtureProfile(), energy: 'medium' },
      plan: plan(['march'], 5),
      tickMs: 100,
    });
    const seen: string[] = [];
    const unsubscribe = l.subscribe((s) => seen.push(s.state.phase));
    l.start();
    l.start(); // idempotent
    vi.advanceTimersByTime(20_000);
    expect(l.snapshot.state.phase).toBe('complete');
    expect(seen).toContain('active');
    unsubscribe();
    expect(l.projection().finalStrain).toBeGreaterThanOrEqual(0);
  });
});

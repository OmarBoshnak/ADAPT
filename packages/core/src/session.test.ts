import { describe, expect, it } from 'vitest';

import { generatePlan } from './generator.js';
import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import {
  ADAPTING_SEC,
  createSession,
  projectionFor,
  reduce,
  summaryFor,
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from './session.js';
import type { Profile, SessionPlan } from './types.js';

const graph = fixtureGraph();

function ctxFor(p: Partial<Profile> = {}): SessionContext {
  return { graph, profile: fixtureProfile(p), energy: 'medium' };
}

/** A hand-written plan, so tests control exactly what runs when. */
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

function run(ctx: SessionContext, s: SessionState, seconds: number, dt = 0.5): SessionState {
  let out = s;
  for (let t = 0; t < seconds; t += dt) out = reduce(ctx, out, { type: 'TICK', dtSec: dt });
  return out;
}

const easier: SessionEvent = { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' };

describe('phases', () => {
  it('counts down get-ready, works, rests, and completes', () => {
    const ctx = ctxFor();
    let s = createSession(ctx, plan(['fast_march', 'march'], 30, 10));
    expect(s.phase).toBe('getready');
    s = run(ctx, s, 8);
    expect(s.phase).toBe('active');
    s = run(ctx, s, 30);
    expect(s.phase).toBe('rest');
    s = run(ctx, s, 10);
    expect(s.phase).toBe('active');
    expect(s.segmentIndex).toBe(1);
    expect(s.currentExerciseId).toBe('march');
    s = run(ctx, s, 31);
    expect(s.phase).toBe('complete');
    expect(reduce(ctx, s, { type: 'TICK', dtSec: 5 })).toBe(s);
  });

  it('handles one large tick the same as many small ones', () => {
    const ctx = ctxFor();
    const p = plan(['fast_march', 'march'], 30, 10);
    const big = reduce(ctx, createSession(ctx, p), { type: 'TICK', dtSec: 60 });
    const small = run(ctx, createSession(ctx, p), 60, 0.25);
    expect(big.phase).toBe(small.phase);
    // Euler steps of 0.5 s vs 0.25 s differ slightly; what matters is that a big tick is split,
    // not integrated as one jump (which would be off by orders of magnitude more).
    expect(Math.abs(big.strain - small.strain) / small.strain).toBeLessThan(0.001);
  });

  it('refuses an empty plan', () => {
    expect(() => createSession(ctxFor(), plan([]))).toThrow();
  });

  it('skips a segment on request', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['fast_march', 'march'])), 10);
    s = reduce(ctx, s, { type: 'SKIP' });
    expect(s.phase).toBe('rest');
  });
});

describe('automatic adaptation — "I noticed"', () => {
  it('fires once strain reaches the threshold, after the first segment', () => {
    const ctx = ctxFor({ personalBias: 0.6 }); // low ceiling so the fixture crosses quickly
    let s = createSession(ctx, plan(['jacks', 'big_jump', 'big_jump'], 120, 10));
    s = run(ctx, s, 8 + 120 + 10 + 120 + 10 + 120);
    const auto = s.adaptations.filter((a) => a.trigger === 'predicted-strain');
    expect(auto.length).toBeGreaterThan(0);
    const first = auto[0];
    expect(first?.atSec).toBeGreaterThan(120); // never in the first segment
    expect(first?.strainAfter).toBeLessThan(first?.strainBefore as number);
    expect(first?.reason.length).toBeGreaterThan(0);
  });

  it('holds the decision panel, then continues on the easier movement', () => {
    const ctx = ctxFor({ personalBias: 0.6 });
    let s = createSession(ctx, plan(['jacks', 'big_jump', 'big_jump'], 120, 10));
    while (s.phase !== 'adapting' && s.phase !== 'complete') s = reduce(ctx, s, { type: 'TICK', dtSec: 0.5 });
    expect(s.phase).toBe('adapting');
    const target = s.pending?.toExerciseId;
    expect(target).toBe('jacks');
    s = run(ctx, s, ADAPTING_SEC);
    expect(s.phase).toBe('active');
    expect(s.currentExerciseId).toBe(target);
    expect(s.pending).toBeNull();
  });
});

describe('corrections — "I learned"', () => {
  it('bypasses the gates, adapts immediately, and teaches the model', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 20);
    s = reduce(ctx, s, easier);
    expect(s.phase).toBe('adapting');
    expect(s.pending?.trigger).toBe('user-correction');
    expect(s.pending?.toExerciseId).toBe('step_jacks');
    expect(s.corrections).toEqual([expect.objectContaining({ direction: 'easier', heard: 'easier' })]);
    expect(s.learning).toHaveLength(1);
    expect(s.bias).toBeLessThan(1);
  });

  it('keeps a pressed button distinct from a spoken word', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 20);
    s = reduce(ctx, s, { type: 'CORRECTION', direction: 'easier', source: 'button' });
    expect(s.corrections[0]).not.toHaveProperty('heard');
    expect(s.corrections[0]?.source).toBe('button');
  });

  it('ends the segment early when the ladder has run out', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['march', 'fast_march'])), 20);
    s = reduce(ctx, s, easier);
    expect(s.pending?.action).toBe('end-segment');
    s = run(ctx, s, ADAPTING_SEC);
    expect(s.phase).toBe('rest');
  });

  it('moves up a rung for "harder", and learns it without dropping strain', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 20);
    const before = s.strain;
    s = reduce(ctx, s, { type: 'CORRECTION', direction: 'harder', source: 'button' });
    expect(s.pending?.toExerciseId).toBe('big_jump');
    expect(s.strain).toBe(before);
    expect(s.bias).toBeGreaterThan(1);
  });

  it('learns "harder" at the top of a ladder without changing the screen', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['big_jump', 'march'])), 20);
    s = reduce(ctx, s, { type: 'CORRECTION', direction: 'harder', source: 'button' });
    expect(s.phase).toBe('active');
    expect(s.bias).toBeGreaterThan(1);
  });

  it('ignores corrections outside a working segment', () => {
    const ctx = ctxFor();
    const s = createSession(ctx, plan(['jacks']));
    expect(reduce(ctx, s, easier)).toBe(s);
  });

  it('never offers a movement this person excluded', () => {
    const ctx = ctxFor({ injuries: ['knee'] });
    let s = run(ctx, createSession(ctx, plan(['big_jump', 'march'])), 20);
    s = reduce(ctx, s, easier);
    expect(s.pending?.toExerciseId).toBe('step_jacks'); // Jacks skipped — it is a jump
  });
});

describe('swap — when a movement does not suit', () => {
  it('changes the movement without learning or dropping strain', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 20);
    const before = s;
    s = reduce(ctx, s, { type: 'SWAP', exerciseId: 'march' });
    expect(s.currentExerciseId).toBe('march');
    expect(s.strain).toBe(before.strain);
    expect(s.bias).toBe(before.bias);
    expect(s.learning).toHaveLength(0);
    expect(s.adaptations).toHaveLength(0);
    expect(s.quality).toBeNull();
  });

  it('is ignored outside a working segment or onto the same movement', () => {
    const ctx = ctxFor();
    const ready = createSession(ctx, plan(['jacks']));
    expect(reduce(ctx, ready, { type: 'SWAP', exerciseId: 'march' })).toBe(ready);
    const active = run(ctx, ready, 10);
    expect(reduce(ctx, active, { type: 'SWAP', exerciseId: 'jacks' })).toBe(active);
  });
});

describe('quality frames', () => {
  const frame = (t: number, quality: number, confidence = 1, profile: 'impact' | 'oscillation' = 'impact') => ({
    type: 'QUALITY' as const,
    frame: { t, quality, cadence: 70, confidence, profile },
  });

  it('smooths trusted frames and ignores untrusted ones', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 10);
    s = reduce(ctx, s, frame(1, 1));
    s = reduce(ctx, s, frame(1.5, 0.2));
    expect(s.quality as number).toBeLessThan(1);
    expect(s.quality as number).toBeGreaterThan(0.2);
    const q = s.quality;
    s = reduce(ctx, s, frame(2, 0, 0.1));
    expect(s.quality).toBe(q);
  });

  it('drops late frames from a movement that is no longer running', () => {
    const ctx = ctxFor();
    const s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 10);
    expect(reduce(ctx, s, frame(1, 0.1, 1, 'oscillation'))).toBe(s);
  });

  it('makes poor movement cost more strain', () => {
    const ctx = ctxFor();
    let good = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 10);
    let poor = good;
    for (let t = 0; t < 30; t += 0.5) {
      good = reduce(ctx, reduce(ctx, good, frame(t, 1)), { type: 'TICK', dtSec: 0.5 });
      poor = reduce(ctx, reduce(ctx, poor, frame(t, 0.3)), { type: 'TICK', dtSec: 0.5 });
    }
    expect(poor.strain).toBeGreaterThan(good.strain);
  });

  it('re-baselines on a new movement', () => {
    const ctx = ctxFor();
    let s = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 10);
    s = reduce(ctx, s, frame(1, 0.5));
    s = reduce(ctx, s, easier);
    s = run(ctx, s, ADAPTING_SEC);
    expect(s.quality).toBeNull();
    expect(s.confidence).toBe(0);
  });
});

describe('selectors', () => {
  it('projects the rest of the session', () => {
    const ctx = ctxFor();
    const s = run(ctx, createSession(ctx, plan(['jacks', 'big_jump', 'big_jump'], 120)), 20);
    const p = projectionFor(ctx, s);
    expect(p.curve.length).toBeGreaterThan(2);
    expect(p.finalStrain).toBeGreaterThan(s.strain);
  });

  it('shows the learning card only after a correction', () => {
    const ctx = ctxFor();
    const quiet = run(ctx, createSession(ctx, plan(['march'])), 80);
    expect(summaryFor(ctx, quiet).learning).toBeNull();

    let spoke = run(ctx, createSession(ctx, plan(['jacks', 'march'])), 20);
    spoke = run(ctx, reduce(ctx, spoke, easier), 200);
    const sum = summaryFor(ctx, spoke);
    expect(sum.learning?.headline).toMatch(/You asked for easier/);
    expect(sum.biasAfter).toBeLessThan(sum.biasBefore);
    expect(sum.adaptedExerciseNames).toEqual(['Jacks']);
  });

  it('runs a generated plan end to end', () => {
    const ctx = ctxFor();
    const p = generatePlan({ graph, profile: ctx.profile, durationMin: 4, energy: 'medium', seed: 1 });
    const s = run(ctx, createSession(ctx, p), 8 + p.totalDurationSec + 30, 1);
    expect(s.phase).toBe('complete');
    expect(s.totalReps).toBeGreaterThan(0);
  });
});

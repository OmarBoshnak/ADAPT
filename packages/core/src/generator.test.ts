import { describe, expect, it } from 'vitest';

import { blocksFrom, exerciseCount, generatePlan, GET_READY_SEC, REST_SEC } from './generator.js';
import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import type { Exercise, Profile } from './types.js';

const graph = fixtureGraph();
const gen = (p: Partial<Profile> = {}, seed = 1, durationMin = 12) =>
  generatePlan({ graph, profile: fixtureProfile(p), durationMin, energy: 'medium', seed });

describe('generatePlan', () => {
  it('is exactly reproducible from its seed', () => {
    expect(gen({}, 42)).toEqual(gen({}, 42));
  });

  it('sizes the session to the requested length', () => {
    for (const minutes of [4, 8, 12, 20, 30]) {
      const p = gen({}, 1, minutes);
      expect(p.segments).toHaveLength(exerciseCount(minutes));
      expect(p.totalDurationSec).toBeLessThanOrEqual(minutes * 60);
      expect(p.totalDurationSec).toBeGreaterThan(minutes * 60 - p.segments.length * 2);
      expect(p.restSec).toBe(REST_SEC.medium);
      expect(p.getReadySec).toBe(GET_READY_SEC);
    }
  });

  it('only starts sessions on movements with somewhere easier to go', () => {
    for (const seg of gen().segments) expect((graph.exercises[seg.exerciseId] as Exercise).adaptsDownTo).not.toBeNull();
  });

  it('respects every exclusion — filter, then select', () => {
    const p = gen({ injuries: ['knee'] });
    for (const seg of p.segments) expect((graph.exercises[seg.exerciseId] as Exercise).tags).not.toContain('plyometric');
    expect(p.exclusionLabels).toContain('jumping movements excluded');
  });

  it('falls back to ladder floors rather than refusing a restrictive profile', () => {
    const p = gen({ injuries: ['knee'], conditions: ['heart condition'] });
    expect(p.segments.length).toBeGreaterThan(0);
  });

  it('refuses only when nothing at all remains', () => {
    const onlyJumping = { ...graph, sessionPool: ['jacks'] };
    const knee = fixtureProfile({ injuries: ['knee'] });
    expect(() => generatePlan({ graph: onlyJumping, profile: knee, durationMin: 12, energy: 'medium', seed: 1 })).toThrow();
  });

  it('keeps high-intensity segments short when asked to', () => {
    const p = gen({ conditions: ['asthma'] });
    for (const seg of p.segments) {
      const ex = graph.exercises[seg.exerciseId] as Exercise;
      if (ex.intensity >= 6) expect(seg.durationSec).toBeLessThanOrEqual(45);
    }
  });

  it('sets rep targets from the movement’s cadence', () => {
    for (const seg of gen().segments) expect(seg.targetReps).toBe(Math.round(seg.durationSec));
  });

  it('plans lighter after the model learns the person needs it', () => {
    const load = (bias: number) =>
      gen({ personalBias: bias }).segments.reduce(
        (a, s) => a + (graph.exercises[s.exerciseId] as Exercise).intensity * s.durationSec,
        0,
      );
    expect(load(0.7)).toBeLessThanOrEqual(load(1));
  });
});

describe('blocksFrom', () => {
  const p = gen();

  it('lays out work and rest with no trailing rest', () => {
    const blocks = blocksFrom(p, graph, 0, 0, false, 0);
    expect(blocks.filter((b) => b.kind === 'work')).toHaveLength(p.segments.length);
    expect(blocks.filter((b) => b.kind === 'rest')).toHaveLength(p.segments.length - 1);
    expect(blocks.at(-1)?.kind).toBe('work');
  });

  it('accounts for time already spent, and for a swapped movement', () => {
    const first = p.segments[0];
    const blocks = blocksFrom(p, graph, 0, 10, false, 0, 'march');
    expect(blocks[0]?.durationSec).toBe((first?.durationSec as number) - 10);
    expect(blocks[0]?.intensity).toBe(2.5);
  });

  it('starts mid-rest correctly', () => {
    const blocks = blocksFrom(p, graph, 0, 0, true, 7);
    expect(blocks[0]).toEqual({ kind: 'rest', durationSec: 7, intensity: 0 });
  });
});

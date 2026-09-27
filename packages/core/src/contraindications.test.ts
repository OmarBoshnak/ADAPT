import { describe, expect, it } from 'vitest';

import {
  constraintsFor,
  eligibilityFor,
  exclusionLabels,
  HIGH_INTENSITY,
  isExcluded,
} from './contraindications.js';
import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import type { Condition, Exercise, Injury, MovementTag } from './types.js';

const INJURIES: Injury[] = ['knee', 'lower back', 'shoulder', 'ankle', 'wrist', 'neck'];
const CONDITIONS: Condition[] = ['high blood pressure', 'asthma', 'heart condition', 'pregnancy', 'joint condition'];
const ALL_TAGS: MovementTag[] = [
  'plyometric', 'high-impact', 'deep-knee-flexion', 'spinal-loading', 'spinal-flexion', 'overhead',
  'inverted', 'isometric-hold', 'supine', 'prone', 'single-leg', 'wrist-loading',
];

const graph = fixtureGraph();
const all = Object.values(graph.exercises);

/** One synthetic movement per tag, so every rule has something to bite on. */
const probes: Exercise[] = ALL_TAGS.map((tag) => ({ ...(graph.exercises.march as Exercise), id: `probe_${tag}`, tags: [tag] }));

describe('contraindications only ever exclude', () => {
  it('excludes nothing for an unrestricted profile', () => {
    const ok = eligibilityFor(fixtureProfile());
    expect([...all, ...probes].every(ok)).toBe(true);
    expect(exclusionLabels(fixtureProfile())).toEqual([]);
  });

  it('adding a limitation never makes anything MORE eligible', () => {
    for (const injury of INJURIES) {
      for (const condition of CONDITIONS) {
        const one = eligibilityFor(fixtureProfile({ injuries: [injury] }));
        const two = eligibilityFor(fixtureProfile({ injuries: [injury], conditions: [condition] }));
        for (const ex of [...all, ...probes]) {
          if (!one(ex)) expect(two(ex)).toBe(false);
        }
      }
    }
  });

  it('every single limitation has an effect, so no checkbox is decorative', () => {
    for (const injury of INJURIES) {
      const ok = eligibilityFor(fixtureProfile({ injuries: [injury] }));
      expect(probes.some((p) => !ok(p))).toBe(true);
    }
    for (const condition of CONDITIONS) {
      const c = constraintsFor(fixtureProfile({ conditions: [condition] }));
      const bites = c.excludedTags.size > 0 || c.maxIntensity < 10 || c.highIntensitySegmentCapSec !== null;
      expect(bites).toBe(true);
    }
  });
});

describe('specific rules', () => {
  it('knee removes jumping', () => {
    const ok = eligibilityFor(fixtureProfile({ injuries: ['knee'] }));
    expect(ok(graph.exercises.jacks as Exercise)).toBe(false);
    expect(ok(graph.exercises.big_jump as Exercise)).toBe(false);
    expect(ok(graph.exercises.march as Exercise)).toBe(true);
  });

  it('heart condition caps intensity', () => {
    const c = constraintsFor(fixtureProfile({ conditions: ['heart condition'] }));
    expect(c.maxIntensity).toBe(5);
    expect(isExcluded(graph.exercises.fast_march as Exercise, c)).toBe(false);
    expect(isExcluded({ ...(graph.exercises.march as Exercise), intensity: 5.5 }, c)).toBe(true);
  });

  it('asthma shortens high-intensity segments instead of excluding', () => {
    const c = constraintsFor(fixtureProfile({ conditions: ['asthma'] }));
    expect(c.excludedTags.size).toBe(0);
    expect(c.highIntensitySegmentCapSec).toBe(45);
    expect(HIGH_INTENSITY).toBeGreaterThan(0);
  });
});

describe('exclusion labels', () => {
  it('describe the plan, never the person', () => {
    const everything = fixtureProfile({ injuries: INJURIES, conditions: CONDITIONS });
    const labels = exclusionLabels(everything);
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) {
      expect(l).toMatch(/excluded|kept short/);
      expect(l).not.toMatch(/\b(you|your|bad|good|risk|danger|unsafe|should|avoid|condition|injur)/i);
    }
  });

  it('fold "hard landings" into "jumping" when both apply, keeping the footer short', () => {
    const labels = exclusionLabels(fixtureProfile({ injuries: ['knee'] }));
    expect(labels).toContain('jumping movements excluded');
    expect(labels).not.toContain('hard landings excluded');
  });

  it('list hard landings on their own when jumping is still allowed', () => {
    expect(exclusionLabels(fixtureProfile({ conditions: ['heart condition'] }))).toContain('hard landings excluded');
  });
});

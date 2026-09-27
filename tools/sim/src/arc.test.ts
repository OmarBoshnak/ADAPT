/**
 * The product's closing argument, as a test.
 *
 * Runs the same headless simulation as `npm run sim`, against a graph built in memory from
 * source, so `npm test` fails if a change to the engine breaks the two-session demo arc or
 * the learning loop's convergence.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildGraph, threshold, type Profile, type RawExercise } from '@adapt/core';
import { CURATION, DATA_VERSION, HOME_PACK } from '@adapt/data';

import { runSession } from './run.js';

const vendor = fileURLToPath(new URL('../../../packages/data/vendor/free-exercise-db/exercises.json', import.meta.url));
const dataset = JSON.parse(readFileSync(vendor, 'utf8')) as RawExercise[];
const full = buildGraph({ version: DATA_VERSION, dataset, homePack: HOME_PACK, curation: CURATION });
const graph = {
  ...full,
  exercises: Object.fromEntries(full.sessionPool.map((id) => [id, full.exercises[id]!])),
};

const person: Profile = {
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: [],
  conditions: [],
  defaultDurationMin: 12,
  intensityPreference: 'steady',
  personalBias: 1,
};
const common = { graph, energy: 'medium' as const, durationMin: 12, seed: 5, paired: true, user: 'fading' as const };

describe('the two-session demo arc', () => {
  let spoken = false;
  const s1 = runSession({
    ...common,
    profile: person,
    speak: (s) => {
      const auto = s.adaptations.find((a) => a.trigger === 'predicted-strain');
      if (spoken || !auto || s.phase !== 'active' || s.sessionElapsedSec < auto.atSec + 60) return null;
      spoken = true;
      return { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' };
    },
  });
  const s2 = runSession({ ...common, profile: { ...person, personalBias: s1.state.bias } });
  const a1 = s1.state.adaptations.find((a) => a.trigger === 'predicted-strain');
  const a2 = s2.state.adaptations.find((a) => a.trigger === 'predicted-strain');

  it('session 1 opens with the spec’s hero moment: Jumping Jacks → Step Jacks, unprompted', () => {
    expect(a1?.fromExerciseId).toBe('adapt_jumping_jacks');
    expect(a1?.toExerciseId).toBe('adapt_step_jacks');
  });

  it('session 1 learns from the correction and shows the card', () => {
    expect(s1.state.bias).toBeLessThan(1);
    expect(s1.summary.learning?.headline).toMatch(/You asked for easier/);
  });

  it('session 2 adapts the same movement visibly sooner, with no one asking', () => {
    expect(s2.state.corrections).toHaveLength(0);
    expect(a2?.fromExerciseId).toBe(a1?.fromExerciseId);
    expect(a2!.segmentElapsedSec).toBeLessThanOrEqual(0.6 * a1!.segmentElapsedSec);
    expect(a1!.atSec - a2!.atSec).toBeGreaterThanOrEqual(20);
  });

  it('session 2 starts lighter', () => {
    const load = (r: typeof s1) =>
      r.plan.segments.reduce((acc, seg) => acc + graph.exercises[seg.exerciseId]!.intensity * seg.durationSec, 0);
    expect(load(s2)).toBeLessThanOrEqual(load(s1));
  });

  it('works with no phone at all — the TV alone still adapts', () => {
    const solo = runSession({ ...common, profile: person, paired: false });
    expect(solo.state.adaptations.some((a) => a.trigger === 'predicted-strain')).toBe(true);
    expect(solo.state.phase).toBe('complete');
  });
});

describe('learning converges on a misjudged person', () => {
  it('stops needing the person to ask, without overshooting their limit', () => {
    const trueLimit = 0.8 * threshold(person, 'medium');
    let bias = 1;
    const corrections: number[] = [];
    for (let k = 0; k < 4; k++) {
      let last = -Infinity;
      const r = runSession({
        ...common,
        profile: { ...person, personalBias: bias },
        speak: (s) => {
          if (s.phase !== 'active' || s.strain < trueLimit || s.sessionElapsedSec - last < 60) return null;
          last = s.sessionElapsedSec;
          return { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' };
        },
      });
      corrections.push(r.state.corrections.length);
      bias = r.state.bias;
    }
    expect(corrections[0]).toBeGreaterThan(0); // they had to ask at first
    expect(corrections.slice(1).every((n) => n === 0)).toBe(true); // then never again
    expect(bias).toBeLessThan(0.8); // the model now acts just before their limit
    expect(bias).toBeGreaterThan(0.72); // but did not overshoot it
  });
});

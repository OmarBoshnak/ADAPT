/**
 * Integration tests against the real corpus: the vendored Free Exercise DB plus the authored
 * home pack and curation, built exactly the way `tools/build-graph` builds it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildGraph,
  eligibilityFor,
  generatePlan,
  getExercise,
  resolveAlternatives,
  selectableIds,
  validateGraph,
  type Condition,
  type Exercise,
  type Injury,
  type Profile,
  type RawExercise,
} from '@adapt/core';

import { CURATION, DATA_VERSION, HOME_PACK } from './index.js';

const vendor = fileURLToPath(new URL('../vendor/free-exercise-db/exercises.json', import.meta.url));
const dataset = JSON.parse(readFileSync(vendor, 'utf8')) as RawExercise[];
const graph = buildGraph({ version: DATA_VERSION, dataset, homePack: HOME_PACK, curation: CURATION });
const pool = graph.sessionPool.map((id) => getExercise(graph, id));

const profile = (p: Partial<Profile> = {}): Profile => ({
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: [],
  conditions: [],
  defaultDurationMin: 12,
  intensityPreference: 'steady',
  personalBias: 1,
  ...p,
});

describe('the real graph', () => {
  it('validates with no problems', () => {
    expect(validateGraph(graph)).toEqual([]);
  });

  it('keeps the whole corpus and the whole home pack', () => {
    expect(dataset).toHaveLength(876);
    expect(Object.keys(graph.exercises)).toHaveLength(876 + HOME_PACK.length);
  });

  it('declares provenance on every record', () => {
    for (const ex of Object.values(graph.exercises)) {
      expect(['free-exercise-db', 'adapt-home-pack']).toContain(ex.source);
    }
    for (const c of CURATION) expect(getExercise(graph, c.id).source).toBe('free-exercise-db');
  });

  it('keeps real demonstration photographs on curated dataset movements', () => {
    for (const c of CURATION) expect(getExercise(graph, c.id).images.length).toBeGreaterThan(0);
  });

  it('builds ladders that cross sources — one graph, not two', () => {
    expect(getExercise(graph, 'Star_Jump').adaptsDownTo).toBe('adapt_jumping_jacks');
    expect(getExercise(graph, 'adapt_squat_calf_raises').adaptsDownTo).toBe('Bodyweight_Squat');
  });

  it('contains the spec’s demo arc exactly', () => {
    const jj = getExercise(graph, 'adapt_jumping_jacks');
    expect(getExercise(graph, jj.adaptsDownTo as string).name).toBe('Step Jacks');
    expect(getExercise(graph, jj.substituteWith as string).name).toBe('Standing March');
  });
});

describe('the session pool is fit for a TV', () => {
  it('has names and cues short enough for the 10-foot layout', () => {
    for (const ex of pool) {
      expect(ex.name.length, ex.name).toBeLessThanOrEqual(28);
      expect((ex.cue as string).length, ex.name).toBeLessThanOrEqual(48);
    }
  });

  it('has real instructions for every authored movement', () => {
    for (const ex of pool.filter((e) => e.source === 'adapt-home-pack')) {
      expect(ex.instructions.length, ex.name).toBeGreaterThanOrEqual(2);
    }
  });

  it('only authored tags ever ADD to derived ones', () => {
    for (const a of HOME_PACK) {
      const built = getExercise(graph, a.id);
      for (const t of a.tags) expect(built.tags).toContain(t);
    }
  });
});

describe('safety property: no plan ever contains an excluded movement', () => {
  const injuries: Injury[] = ['knee', 'lower back', 'shoulder', 'ankle', 'wrist', 'neck'];
  const conditions: Condition[] = ['high blood pressure', 'asthma', 'heart condition', 'pregnancy', 'joint condition'];
  const cases: Array<Partial<Profile>> = [
    ...injuries.map((i) => ({ injuries: [i] })),
    ...conditions.map((c) => ({ conditions: [c] })),
    { injuries: ['knee', 'wrist'], conditions: ['pregnancy'] },
    { injuries: ['knee', 'ankle', 'shoulder'], conditions: ['heart condition'] },
  ];

  for (const c of cases) {
    const label = [...(c.injuries ?? []), ...(c.conditions ?? [])].join(' + ');
    it(label, () => {
      const p = profile(c);
      const ok = eligibilityFor(p);
      for (let seed = 1; seed <= 25; seed++) {
        for (const minutes of [4, 12, 30]) {
          const plan = generatePlan({ graph, profile: p, durationMin: minutes, energy: 'medium', seed });
          for (const seg of plan.segments) {
            const ex = getExercise(graph, seg.exerciseId);
            expect(ok(ex), `${ex.name} in plan for ${label}`).toBe(true);
          }
          // and every alternative TV-4b could offer is eligible too
          for (const seg of plan.segments) {
            const alt = resolveAlternatives(graph, seg.exerciseId, ok);
            if (alt.easier) expect(ok(alt.easier)).toBe(true);
            if (alt.different) expect(ok(alt.different)).toBe(true);
          }
        }
      }
    });
  }

  it('knee excludes every jumping movement in the pool', () => {
    const ok = eligibilityFor(profile({ injuries: ['knee'] }));
    const jumping = pool.filter((e: Exercise) => e.tags.includes('plyometric'));
    expect(jumping.length).toBeGreaterThan(5);
    for (const ex of jumping) expect(ok(ex), ex.name).toBe(false);
  });

  it('leaves every single limitation enough to build a varied session', () => {
    for (const c of cases.slice(0, injuries.length + conditions.length)) {
      const ok = eligibilityFor(profile(c));
      const selectable = selectableIds(graph).map((id) => getExercise(graph, id)).filter(ok);
      expect(selectable.length, JSON.stringify(c)).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('generation on the real pool', () => {
  it('varies between sessions — "Generated fresh"', () => {
    const plans = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      plans.add(generatePlan({ graph, profile: profile(), durationMin: 12, energy: 'medium', seed }).segments.map((s) => s.exerciseId).join());
    }
    expect(plans.size).toBeGreaterThanOrEqual(15);
  });

  it('opens gentler than it continues', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = generatePlan({ graph, profile: profile(), durationMin: 12, energy: 'medium', seed });
      const [first, ...rest] = plan.segments.map((s) => getExercise(graph, s.exerciseId).intensity);
      const mean = rest.reduce((a, b) => a + b, 0) / rest.length;
      expect(first as number).toBeLessThan(mean);
    }
  });

  it('builds a moderate plan for a medium-energy session, not the hardest movements', () => {
    const plan = generatePlan({ graph, profile: profile(), durationMin: 12, energy: 'medium', seed: 5 });
    const mean = plan.segments.reduce((a, s) => a + getExercise(graph, s.exerciseId).intensity, 0) / plan.segments.length;
    expect(mean).toBeGreaterThan(4.5);
    expect(mean).toBeLessThan(7);
  });
});

describe('short sessions', () => {
  it('are the same kind of work, not the hardest movements in the pool', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const plan = generatePlan({ graph, profile: profile(), durationMin: 4, energy: 'medium', seed });
      for (const seg of plan.segments) {
        const ex = getExercise(graph, seg.exerciseId);
        expect(ex.intensity, `${ex.name} in a 4-minute medium session (seed ${seed})`).toBeLessThanOrEqual(7);
      }
    }
  });

  it('still allow hard movements when the person says they have the energy', () => {
    const hard = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      for (const seg of generatePlan({ graph, profile: profile(), durationMin: 4, energy: 'high', seed }).segments) {
        if (getExercise(graph, seg.exerciseId).intensity > 7) hard.add(seg.exerciseId);
      }
    }
    expect(hard.size).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { eligibilityFor } from './contraindications.js';
import {
  autoEdges,
  buildGraph,
  getExercise,
  harderThan,
  resolveAlternatives,
  selectableIds,
  validateGraph,
  type AuthoredExercise,
} from './graph.js';
import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import type { Exercise, ExerciseGraph, RawExercise } from './types.js';

describe('validateGraph', () => {
  it('accepts a well-formed pool', () => {
    expect(validateGraph(fixtureGraph())).toEqual([]);
  });

  const broken = (mutate: (g: ExerciseGraph) => void) => {
    const g = fixtureGraph();
    mutate(g);
    return validateGraph(g);
  };

  it('rejects a step down that is not easier', () => {
    expect(broken((g) => ((g.exercises.step_jacks as Exercise).intensity = 9)).join()).toMatch(/not easier/);
  });

  it('rejects a missing substitute', () => {
    expect(broken((g) => ((g.exercises.jacks as Exercise).substituteWith = null)).join()).toMatch(/no substituteWith/);
  });

  it('rejects a substitute from the same pattern family', () => {
    expect(broken((g) => ((g.exercises.jacks as Exercise).substituteWith = 'step_jacks')).join()).toMatch(/same pattern/);
  });

  it('rejects a substitute that adds impact', () => {
    expect(broken((g) => ((g.exercises.march as Exercise).substituteWith = 'jacks')).join()).toMatch(/adds impact/);
  });

  it('rejects dangling and out-of-pool edges', () => {
    expect(broken((g) => ((g.exercises.jacks as Exercise).adaptsDownTo = 'nope')).join()).toMatch(/does not exist/);
    expect(
      broken((g) => {
        g.sessionPool = g.sessionPool.filter((id) => id !== 'march');
      }).join(),
    ).toMatch(/outside the session pool/);
  });

  it('rejects a cycle down the ladder', () => {
    expect(
      broken((g) => {
        (g.exercises.march as Exercise).adaptsDownTo = 'fast_march';
        (g.exercises.march as Exercise).intensity = 1;
      }).join(),
    ).toMatch(/cycle/);
  });

  it('rejects pool movements missing a cue, cadence or family', () => {
    const problems = broken((g) => {
      const j = g.exercises.jacks as Exercise;
      j.cue = null;
      j.expectedCadence = null;
    }).join();
    expect(problems).toMatch(/no coaching cue/);
    expect(problems).toMatch(/no expected cadence/);
  });
});

describe('lookups', () => {
  const g = fixtureGraph();

  it('only lets sessions start on movements with somewhere easier to go', () => {
    expect(selectableIds(g).sort()).toEqual(['big_jump', 'fast_march', 'jacks']);
  });

  it('finds the rung above for "harder"', () => {
    expect(harderThan(g, 'step_jacks')?.id).toBe('jacks');
    expect(harderThan(g, 'big_jump')).toBeNull();
  });

  it('throws on an unknown id rather than guessing', () => {
    expect(() => getExercise(g, 'nope')).toThrow();
  });
});

describe('resolveAlternatives — TV-4b', () => {
  const g = fixtureGraph();

  it('offers the next rung and a different pattern', () => {
    const a = resolveAlternatives(g, 'big_jump', () => true);
    expect(a.easier?.id).toBe('jacks');
    expect(a.different?.id).toBe('march');
  });

  it('skips rungs this person has excluded', () => {
    const a = resolveAlternatives(g, 'big_jump', eligibilityFor(fixtureProfile({ injuries: ['knee'] })));
    expect(a.easier?.id).toBe('step_jacks'); // Jacks is a jump — skipped
    expect(a.different?.id).toBe('march');
  });

  it('returns nothing rather than something unsuitable', () => {
    const a = resolveAlternatives(g, 'step_jacks', () => false);
    expect(a.easier).toBeNull();
    expect(a.different).toBeNull();
  });
});

describe('buildGraph', () => {
  const dataset: RawExercise[] = [
    { id: 'Squat', name: 'Squat', force: 'push', level: 'intermediate', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [], category: 'strength', images: ['Squat/0.jpg'] },
    { id: 'Half_Squat', name: 'Half Squat', force: 'push', level: 'beginner', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
    { id: 'Jump_Squat', name: 'Jump Squat', force: 'push', level: 'beginner', mechanic: 'compound', equipment: 'body only', primaryMuscles: ['quadriceps'], secondaryMuscles: [], instructions: [], category: 'strength', images: [] },
  ];
  const home: AuthoredExercise = {
    ...(dataset[1] as RawExercise),
    id: 'adapt_wall_squat',
    name: 'Chair Squat',
    tags: ['supine'],
    family: 'squat',
    intensity: 2,
    signalProfile: 'sustained',
    expectedCadence: 20,
    adaptsDownTo: null,
    substituteWith: 'Squat',
    cue: 'Sit and stand',
  };

  it('tags provenance and unions authored tags with derived ones', () => {
    const g = buildGraph({ version: 't', dataset, homePack: [home], curation: [] });
    expect(g.exercises.Squat?.source).toBe('free-exercise-db');
    const h = g.exercises.adapt_wall_squat as Exercise;
    expect(h.source).toBe('adapt-home-pack');
    expect(h.tags).toEqual(expect.arrayContaining(['supine', 'deep-knee-flexion']));
    expect(g.sessionPool).toEqual(['adapt_wall_squat']);
  });

  it('applies curation additively', () => {
    const g = buildGraph({
      version: 't',
      dataset,
      homePack: [],
      curation: [{ id: 'Squat', family: 'squat', intensity: 5, signalProfile: 'sustained', expectedCadence: 20, adaptsDownTo: 'Half_Squat', substituteWith: 'Half_Squat', cue: 'x', extraTags: ['overhead'] }],
    });
    const s = g.exercises.Squat as Exercise;
    expect(s.intensity).toBe(5);
    expect(s.tags).toEqual(expect.arrayContaining(['deep-knee-flexion', 'overhead']));
  });

  it('refuses unknown curation ids and id collisions', () => {
    expect(() => buildGraph({ version: 't', dataset, homePack: [], curation: [{ ...home, id: 'Nope' }] })).toThrow();
    expect(() => buildGraph({ version: 't', dataset, homePack: [{ ...home, id: 'Squat' }], curation: [] })).toThrow();
  });

  it('never makes "easier" mean "now with a jump"', () => {
    const corpus = Object.values(buildGraph({ version: 't', dataset, homePack: [], curation: [] }).exercises);
    const edges = autoEdges(corpus);
    expect(edges.get('Squat')?.adaptsDownTo).toBe('Half_Squat');
    for (const [, e] of edges) expect(e.adaptsDownTo).not.toBe('Jump_Squat');
  });
});

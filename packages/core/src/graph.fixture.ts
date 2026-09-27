/**
 * A tiny hand-built graph for unit tests. Two ladders, two families, one floor each — small
 * enough to reason about by eye, shaped like the real session pool.
 *
 *   jacks:  Big Jump 7.0 → Jacks 6.0 → Step Jacks 3.5 (floor)
 *   march:  Fast March 4.0 → March 2.5 (floor)
 */

import type { Exercise, ExerciseGraph, Profile } from './types.js';

function ex(p: Partial<Exercise> & Pick<Exercise, 'id' | 'name' | 'intensity' | 'family'>): Exercise {
  return {
    force: 'push',
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'body only',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    instructions: [],
    category: 'cardio',
    images: [],
    source: 'adapt-home-pack',
    signalProfile: 'impact',
    tags: [],
    adaptsDownTo: null,
    substituteWith: null,
    expectedCadence: 60,
    cue: 'Keep going',
    ...p,
  };
}

export function fixtureGraph(): ExerciseGraph {
  const exercises: Record<string, Exercise> = {
    big_jump: ex({ id: 'big_jump', name: 'Big Jump', intensity: 7, family: 'jacks', tags: ['plyometric', 'high-impact'], adaptsDownTo: 'jacks', substituteWith: 'march' }),
    jacks: ex({ id: 'jacks', name: 'Jacks', intensity: 6, family: 'jacks', tags: ['plyometric'], adaptsDownTo: 'step_jacks', substituteWith: 'march' }),
    step_jacks: ex({ id: 'step_jacks', name: 'Step Jacks', intensity: 3.5, family: 'jacks', signalProfile: 'oscillation', substituteWith: 'march' }),
    fast_march: ex({ id: 'fast_march', name: 'Fast March', intensity: 4, family: 'march', signalProfile: 'oscillation', adaptsDownTo: 'march', substituteWith: 'step_jacks' }),
    march: ex({ id: 'march', name: 'March', intensity: 2.5, family: 'march', signalProfile: 'oscillation', substituteWith: 'step_jacks' }),
  };
  return { version: 'test', exercises, sessionPool: Object.keys(exercises).sort() };
}

export function fixtureProfile(p: Partial<Profile> = {}): Profile {
  return {
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
  };
}

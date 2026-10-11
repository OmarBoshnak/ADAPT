import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildGraph, computeIntensity, ladder, stats, type RawExercise } from '../src/index.js';

const sample = JSON.parse(readFileSync(new URL('./sample.json', import.meta.url), 'utf8')) as RawExercise[];
const graph = buildGraph(sample);
const byId = (id: string) => graph.exercises[id]!;

describe('intensity', () => {
  it('orders movements the way a coach would, where the dataset can tell them apart', () => {
    expect(byId('Pushups').intensity).toBeLessThan(byId('Single-Arm_Push-Up').intensity);
    expect(byId('Bodyweight_Squat').intensity).toBeLessThan(byId('Freehand_Jump_Squat').intensity);
    expect(byId('Plank').intensity).toBeLessThan(byId('Pushups').intensity);
  });

  it('scores movements the dataset describes identically as equal, rather than inventing a difference', () => {
    expect(byId('Incline_Push-Up').intensity).toBe(byId('Pushups').intensity);
  });

  it('stays on a 0–10 scale', () => {
    for (const ex of sample) {
      const i = computeIntensity(ex);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(10);
    }
  });
});

describe('edges', () => {
  it('steps down to a strictly easier version of the same pattern', () => {
    for (const ex of Object.values(graph.exercises)) {
      if (!ex.adaptsDownTo) continue;
      const down = byId(ex.adaptsDownTo);
      expect(down.pattern).toBe(ex.pattern);
      expect(down.intensity).toBeLessThan(ex.intensity);
      expect(down.primaryMuscles.sort()).toEqual(ex.primaryMuscles.sort());
    }
  });

  it('never makes something "easier" by adding a jump', () => {
    for (const ex of Object.values(graph.exercises)) {
      for (const id of [ex.adaptsDownTo, ex.substituteWith]) {
        if (!id) continue;
        const to = byId(id);
        if (to.tags.includes('plyometric')) expect(ex.tags).toContain('plyometric');
      }
    }
  });

  it('substitutes a different pattern', () => {
    for (const ex of Object.values(graph.exercises)) {
      if (ex.substituteWith && ex.pattern) expect(byId(ex.substituteWith).pattern).not.toBe(ex.pattern);
    }
  });

  it('walks a ladder hardest first', () => {
    const steps = ladder(graph, 'Single-Arm_Push-Up').map((e) => e.intensity);
    expect(steps.length).toBeGreaterThan(1);
    expect([...steps].sort((a, b) => b - a)).toEqual(steps);
  });
});

const full = new URL('../../../packages/data/vendor/free-exercise-db/exercises.json', import.meta.url);

describe.skipIf(!existsSync(full))('the whole dataset', () => {
  it('builds a graph for every exercise', () => {
    const dataset = JSON.parse(readFileSync(full, 'utf8')) as RawExercise[];
    const s = stats(buildGraph(dataset));
    expect(s.exercises).toBe(dataset.length);
    expect(s.withStepDown).toBeGreaterThan(100);
    expect(s.withSubstitute / s.exercises).toBeGreaterThan(0.7);
  });
});

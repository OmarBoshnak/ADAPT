import { computeIntensity, deriveTags, patternStem } from './intensity.js';
import type { Category, ExerciseGraph, GraphExercise, MovementTag, RawExercise } from './types.js';

const IMPACT_TAGS: MovementTag[] = ['plyometric', 'high-impact'];
const MIN_STEP_DOWN = 0.3;
const SUBSTITUTE_BELOW = 2;
const SUBSTITUTE_ABOVE = 0.5;

function categoryGroup(c: Category): string {
  if (c === 'stretching') return 'mobility';
  if (c === 'plyometrics' || c === 'cardio') return 'conditioning';
  return 'strength';
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((x) => a.includes(x));

function jaccard(a: string[], b: string[]): number {
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : b.filter((x) => a.includes(x)).length / union;
}

// Never "easier" by adding a jump.
const addsImpact = (from: GraphExercise, to: GraphExercise) =>
  IMPACT_TAGS.some((t) => to.tags.includes(t) && !from.tags.includes(t));

function stepDown(ex: GraphExercise, corpus: GraphExercise[]): GraphExercise | null {
  if (!ex.pattern) return null;
  let best: GraphExercise | null = null;
  for (const c of corpus) {
    if (c.id === ex.id || c.pattern !== ex.pattern) continue;
    if (c.category !== ex.category || c.equipment !== ex.equipment) continue;
    if (!sameSet(c.primaryMuscles, ex.primaryMuscles)) continue;
    if (c.intensity > ex.intensity - MIN_STEP_DOWN || addsImpact(ex, c)) continue;
    if (!best || c.intensity > best.intensity || (c.intensity === best.intensity && c.id < best.id)) best = c;
  }
  return best;
}

function substitute(ex: GraphExercise, corpus: GraphExercise[]): GraphExercise | null {
  let best: GraphExercise | null = null;
  let bestScore = -Infinity;
  for (const c of corpus) {
    if (c.id === ex.id || (c.pattern !== null && c.pattern === ex.pattern)) continue;
    if (categoryGroup(c.category) !== categoryGroup(ex.category)) continue;
    if (c.equipment !== ex.equipment && c.equipment !== 'body only') continue;
    const overlap = jaccard(c.primaryMuscles, ex.primaryMuscles);
    if (overlap === 0) continue;
    if (c.intensity < ex.intensity - SUBSTITUTE_BELOW || c.intensity > ex.intensity + SUBSTITUTE_ABOVE) continue;
    if (addsImpact(ex, c)) continue;
    const score = overlap - 0.2 * Math.abs(c.intensity - ex.intensity);
    if (score > bestScore || (score === bestScore && best && c.id < best.id)) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Scores every exercise and links each to an easier version and a substitute, where an honest one exists. */
export function buildGraph(dataset: RawExercise[]): ExerciseGraph {
  const corpus: GraphExercise[] = dataset.map((raw) => ({
    ...raw,
    intensity: computeIntensity(raw),
    tags: deriveTags(raw),
    pattern: patternStem(raw.name),
    adaptsDownTo: null,
    substituteWith: null,
  }));
  const exercises: Record<string, GraphExercise> = {};
  for (const ex of corpus) {
    exercises[ex.id] = { ...ex, adaptsDownTo: stepDown(ex, corpus)?.id ?? null, substituteWith: substitute(ex, corpus)?.id ?? null };
  }
  return { exercises };
}

/** The chain of ever-easier versions starting at `id`, hardest first. */
export function ladder(graph: ExerciseGraph, id: string): GraphExercise[] {
  const out: GraphExercise[] = [];
  for (let ex = graph.exercises[id]; ex && !out.includes(ex); ex = ex.adaptsDownTo ? graph.exercises[ex.adaptsDownTo] : undefined) {
    out.push(ex);
  }
  return out;
}

export interface GraphStats {
  exercises: number;
  withStepDown: number;
  withSubstitute: number;
}

export function stats(graph: ExerciseGraph): GraphStats {
  const all = Object.values(graph.exercises);
  return {
    exercises: all.length,
    withStepDown: all.filter((e) => e.adaptsDownTo).length,
    withSubstitute: all.filter((e) => e.substituteWith).length,
  };
}

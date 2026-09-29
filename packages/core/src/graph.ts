// adaptsDownTo: easier version of the same pattern. substituteWith: different pattern, same muscles.
// Pool edges are hand-authored; automatic edges for the wider corpus prefer null over a wrong pairing.

import { computeIntensity, deriveSignalProfile, deriveTags, patternStem } from './intensity.js';
import type {
  Category,
  Exercise,
  ExerciseGraph,
  MovementTag,
  RawExercise,
  SignalProfile,
} from './types.js';

export interface PoolFields {
  family: string;
  intensity: number;
  signalProfile: SignalProfile;
  expectedCadence: number;
  adaptsDownTo: string | null;
  substituteWith: string;
  cue: string;
}

/** Curation may only add tags. */
export interface PoolCuration extends PoolFields {
  id: string;
  extraTags?: MovementTag[];
}

export interface AuthoredExercise extends RawExercise, PoolFields {
  tags: MovementTag[];
}

const union = <T>(a: T[], b: T[]): T[] => [...new Set([...a, ...b])];

function enrichDataset(raw: RawExercise): Exercise {
  return {
    ...raw,
    source: 'free-exercise-db',
    intensity: computeIntensity(raw),
    signalProfile: deriveSignalProfile(raw),
    tags: deriveTags(raw),
    adaptsDownTo: null,
    substituteWith: null,
    expectedCadence: null,
    family: null,
    cue: null,
  };
}

function enrichAuthored(a: AuthoredExercise): Exercise {
  const { tags, family, intensity, signalProfile, expectedCadence, adaptsDownTo, substituteWith, cue, ...raw } = a;
  return {
    ...raw,
    source: 'adapt-home-pack',
    // Union, so an author can never un-flag a jump.
    tags: union(deriveTags(raw), tags),
    family,
    intensity,
    signalProfile,
    expectedCadence,
    adaptsDownTo,
    substituteWith,
    cue,
  };
}

export interface BuildGraphInput {
  version: string;
  dataset: RawExercise[];
  homePack: AuthoredExercise[];
  curation: PoolCuration[];
}

export function buildGraph(input: BuildGraphInput): ExerciseGraph {
  const exercises: Record<string, Exercise> = {};

  for (const raw of input.dataset) exercises[raw.id] = enrichDataset(raw);

  const auto = autoEdges(Object.values(exercises));
  for (const [id, edges] of auto) {
    const ex = exercises[id];
    if (ex) Object.assign(ex, edges);
  }

  for (const c of input.curation) {
    const ex = exercises[c.id];
    if (!ex) throw new Error(`Curation references unknown dataset exercise "${c.id}"`);
    Object.assign(ex, {
      family: c.family,
      intensity: c.intensity,
      signalProfile: c.signalProfile,
      expectedCadence: c.expectedCadence,
      adaptsDownTo: c.adaptsDownTo,
      substituteWith: c.substituteWith,
      cue: c.cue,
      tags: union(ex.tags, c.extraTags ?? []),
    });
  }

  for (const a of input.homePack) {
    if (exercises[a.id]) throw new Error(`Home pack id "${a.id}" collides with a dataset id`);
    exercises[a.id] = enrichAuthored(a);
  }

  const sessionPool = [...input.homePack.map((a) => a.id), ...input.curation.map((c) => c.id)].sort();

  return { version: input.version, exercises, sessionPool };
}

const IMPACT_TAGS: MovementTag[] = ['plyometric', 'high-impact'];

function categoryGroup(c: Category): string {
  if (c === 'stretching') return 'mobility';
  if (c === 'plyometrics' || c === 'cardio') return 'conditioning';
  return 'strength';
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

function addsImpact(from: Exercise, to: Exercise): boolean {
  return IMPACT_TAGS.some((t) => to.tags.includes(t) && !from.tags.includes(t));
}

const MIN_STEP_DOWN = 0.3;

export function autoEdges(
  corpus: Exercise[],
): Map<string, { adaptsDownTo: string | null; substituteWith: string | null }> {
  const stems = new Map(corpus.map((e) => [e.id, patternStem(e.name)]));
  const out = new Map<string, { adaptsDownTo: string | null; substituteWith: string | null }>();

  for (const ex of corpus) {
    const stem = stems.get(ex.id) ?? null;

    let down: Exercise | null = null;
    if (stem) {
      for (const c of corpus) {
        if (c.id === ex.id || stems.get(c.id) !== stem) continue;
        if (c.category !== ex.category || c.equipment !== ex.equipment) continue;
        if (!sameSet(c.primaryMuscles, ex.primaryMuscles)) continue;
        if (c.intensity > ex.intensity - MIN_STEP_DOWN) continue;
        // Never "easier" by adding a jump.
        if (addsImpact(ex, c)) continue;
        if (!down || c.intensity > down.intensity || (c.intensity === down.intensity && c.id < down.id)) {
          down = c;
        }
      }
    }

    let sub: Exercise | null = null;
    let bestScore = -Infinity;
    for (const c of corpus) {
      if (c.id === ex.id) continue;
      const cStem = stems.get(c.id) ?? null;
      if (cStem !== null && cStem === stem) continue; // must be a different pattern
      if (categoryGroup(c.category) !== categoryGroup(ex.category)) continue;
      if (c.equipment !== ex.equipment && c.equipment !== 'body only') continue;
      const overlap = jaccard(c.primaryMuscles, ex.primaryMuscles);
      if (overlap === 0) continue;
      if (c.intensity < ex.intensity - 2 || c.intensity > ex.intensity + 0.5) continue;
      if (addsImpact(ex, c)) continue;
      const score = overlap - 0.2 * Math.abs(c.intensity - ex.intensity);
      if (score > bestScore || (score === bestScore && sub && c.id < sub.id)) {
        bestScore = score;
        sub = c;
      }
    }

    out.set(ex.id, { adaptsDownTo: down?.id ?? null, substituteWith: sub?.id ?? null });
  }
  return out;
}

export function validateGraph(graph: ExerciseGraph): string[] {
  const problems: string[] = [];
  const pool = new Set(graph.sessionPool);
  const get = (id: string) => graph.exercises[id];

  for (const id of graph.sessionPool) {
    const ex = get(id);
    if (!ex) {
      problems.push(`pool entry "${id}" does not exist`);
      continue;
    }
    if (!ex.family) problems.push(`${id}: no family`);
    if (!ex.cue) problems.push(`${id}: no coaching cue`);
    if (!ex.expectedCadence || ex.expectedCadence <= 0) problems.push(`${id}: no expected cadence`);

    if (!ex.substituteWith) {
      problems.push(`${id}: no substituteWith`);
    } else {
      const sub = get(ex.substituteWith);
      if (!sub) problems.push(`${id}: substituteWith "${ex.substituteWith}" does not exist`);
      else {
        if (!pool.has(sub.id)) problems.push(`${id}: substituteWith "${sub.id}" is outside the session pool`);
        if (sub.family === ex.family) problems.push(`${id}: substitute "${sub.id}" is the same pattern family`);
        if (addsImpact(ex, sub)) problems.push(`${id}: substitute "${sub.id}" adds impact`);
      }
    }

    if (ex.adaptsDownTo) {
      const down = get(ex.adaptsDownTo);
      if (!down) problems.push(`${id}: adaptsDownTo "${ex.adaptsDownTo}" does not exist`);
      else {
        if (!pool.has(down.id)) problems.push(`${id}: adaptsDownTo "${down.id}" is outside the session pool`);
        if (down.intensity >= ex.intensity) {
          problems.push(`${id}: adaptsDownTo "${down.id}" is not easier (${down.intensity} >= ${ex.intensity})`);
        }
      }
    }

    const seen = new Set<string>();
    let cur: string | null = id;
    while (cur) {
      if (seen.has(cur)) {
        problems.push(`${id}: adaptsDownTo chain has a cycle`);
        break;
      }
      seen.add(cur);
      cur = get(cur)?.adaptsDownTo ?? null;
    }
  }

  if (selectableIds(graph).length === 0) problems.push('no selectable movements in the session pool');
  return problems;
}

export function getExercise(graph: ExerciseGraph, id: string): Exercise {
  const ex = graph.exercises[id];
  if (!ex) throw new Error(`Unknown exercise "${id}"`);
  return ex;
}

/** Pool movements with somewhere easier to go. */
export function selectableIds(graph: ExerciseGraph): string[] {
  return graph.sessionPool.filter((id) => graph.exercises[id]?.adaptsDownTo);
}

export function harderThan(graph: ExerciseGraph, id: string): Exercise | null {
  const above = graph.sessionPool
    .map((p) => graph.exercises[p])
    .filter((e): e is Exercise => !!e && e.adaptsDownTo === id)
    .sort((a, b) => a.intensity - b.intensity || a.id.localeCompare(b.id));
  return above[0] ?? null;
}

export interface Alternatives {
  easier: Exercise | null;
  different: Exercise | null;
}

/** Walks the edges, since an authored edge can point at something this person has excluded. */
export function resolveAlternatives(
  graph: ExerciseGraph,
  id: string,
  isEligible: (ex: Exercise) => boolean,
): Alternatives {
  const start = getExercise(graph, id);

  let easier: Exercise | null = null;
  let cur = start.adaptsDownTo;
  while (cur) {
    const ex = getExercise(graph, cur);
    if (isEligible(ex)) {
      easier = ex;
      break;
    }
    cur = ex.adaptsDownTo;
  }

  let different: Exercise | null = null;
  const visited = new Set([start.id]);
  let next = start.substituteWith;
  while (next && !visited.has(next)) {
    visited.add(next);
    const ex = getExercise(graph, next);
    if (ex.family !== start.family && isEligible(ex)) {
      different = ex;
      break;
    }
    next = ex.substituteWith;
  }

  return { easier, different };
}

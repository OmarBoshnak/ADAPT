// Plans are sized so predicted strain reaches the threshold about two-thirds through:
// plan to the edge, adapt to stay under. Deterministic for a given seed.

import { constraintsFor, exclusionLabels, HIGH_INTENSITY, isExcluded } from './contraindications.js';
import { getExercise, selectableIds } from './graph.js';
import { createRng } from './random.js';
import { PLAN_BIAS_SHARE, project, threshold, type Block } from './strain.js';
import type { Energy, Exercise, ExerciseGraph, Profile, SessionPlan, SessionSegment } from './types.js';

export const GET_READY_SEC = 8;
export const REST_SEC: Record<Energy, number> = { low: 30, medium: 20, high: 15 };

export const TARGET_CROSSING_FRACTION = 0.65;

/** Seeded jitter per slot, in intensity points. */
export const VARIETY = 0.9;

// Without a ceiling, short sessions chase the threshold with burpees and split jumps.
export const ENERGY_CEILING: Record<Energy, number> = { low: 5.5, medium: 7.0, high: 10 };

const TITLE_NOUN: Record<Energy, string> = { low: 'Easy Cardio', medium: 'Cardio Reset', high: 'Cardio Push' };

export function exerciseCount(durationMin: number): number {
  if (durationMin <= 4) return 3;
  if (durationMin <= 8) return 5;
  if (durationMin <= 12) return 6;
  if (durationMin <= 20) return 8;
  return 10;
}

/** Remaining work/rest blocks; `currentExerciseId` reflects an adaptation already made. */
export function blocksFrom(
  plan: SessionPlan,
  graph: ExerciseGraph,
  segmentIndex: number,
  segmentElapsedSec: number,
  inRest: boolean,
  restRemainingSec: number,
  currentExerciseId?: string,
): Block[] {
  const blocks: Block[] = [];
  const last = plan.segments.length - 1;

  for (let i = segmentIndex; i <= last; i++) {
    const seg = plan.segments[i] as SessionSegment;
    const isCurrent = i === segmentIndex;

    if (!(isCurrent && inRest)) {
      const id = isCurrent && currentExerciseId ? currentExerciseId : seg.exerciseId;
      const remaining = isCurrent ? Math.max(0, seg.durationSec - segmentElapsedSec) : seg.durationSec;
      if (remaining > 0) blocks.push({ kind: 'work', durationSec: remaining, intensity: getExercise(graph, id).intensity });
    }

    if (i < last) {
      const restLeft = isCurrent && inRest ? restRemainingSec : plan.restSec;
      if (restLeft > 0) blocks.push({ kind: 'rest', durationSec: restLeft, intensity: 0 });
    }
  }
  return blocks;
}

export interface GenerateInput {
  graph: ExerciseGraph;
  profile: Profile;
  durationMin: number;
  energy: Energy;
  seed: number;
}

interface Draft {
  ids: string[];
  crossingSec: number | null;
}

export function generatePlan(input: GenerateInput): SessionPlan {
  const { graph, profile, durationMin, energy, seed } = input;
  const constraints = constraintsFor(profile);

  let candidates = selectableIds(graph)
    .map((id) => getExercise(graph, id))
    .filter((ex) => !isExcluded(ex, constraints));

  // A restrictive profile can exclude every movement with a step down.
  if (candidates.length === 0) {
    candidates = graph.sessionPool.map((id) => getExercise(graph, id)).filter((ex) => !isExcluded(ex, constraints));
  }
  if (candidates.length === 0) {
    throw new Error('No movements remain after applying this profile’s exclusions');
  }
  candidates.sort((a, b) => a.intensity - b.intensity || a.id.localeCompare(b.id));

  const n = exerciseCount(durationMin);
  const restSec = REST_SEC[energy];
  const totalSec = durationMin * 60;
  const workSec = Math.max(20, Math.floor((totalSec - (n - 1) * restSec) / n));
  const cap = constraints.highIntensitySegmentCapSec;
  const durationFor = (ex: Exercise) => (cap !== null && ex.intensity >= HIGH_INTENSITY ? Math.min(workSec, cap) : workSec);

  const T = threshold(profile, energy, PLAN_BIAS_SHARE);
  const targetCrossing = TARGET_CROSSING_FRACTION * totalSec;

  const draft = (targetIntensity: number): Draft => {
    const ids = sequence(candidates, n, targetIntensity, seed, ceiling);
    const blocks: Block[] = [];
    ids.forEach((id, i) => {
      const ex = getExercise(graph, id);
      blocks.push({ kind: 'work', durationSec: durationFor(ex), intensity: ex.intensity });
      if (i < ids.length - 1) blocks.push({ kind: 'rest', durationSec: restSec, intensity: 0 });
    });
    return { ids, crossingSec: project(0, T, blocks, 1, 1, 60).secondsUntilThreshold };
  };

  // Drafts are discrete, so keep the closest seen rather than the last.
  const ceiling = ENERGY_CEILING[energy];
  const lo0 = candidates[0]?.intensity ?? 0;
  const hi0 = Math.max(lo0, Math.min(candidates[candidates.length - 1]?.intensity ?? 10, ceiling));
  let lo = lo0;
  let hi = hi0;
  let best = draft(hi0);
  const distance = (d: Draft) => (d.crossingSec === null ? Infinity : Math.abs(d.crossingSec - targetCrossing));

  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const d = draft(mid);
    if (distance(d) < distance(best)) best = d;
    if (d.crossingSec === null || d.crossingSec > targetCrossing) lo = mid;
    else hi = mid;
  }

  const segments: SessionSegment[] = best.ids.map((id) => {
    const ex = getExercise(graph, id);
    const durationSec = durationFor(ex);
    return {
      exerciseId: id,
      durationSec,
      targetReps: Math.max(1, Math.round((durationSec * (ex.expectedCadence ?? 30)) / 60)),
    };
  });

  return {
    id: `plan-${seed.toString(36)}-${durationMin}`,
    title: `${durationMin}-Minute ${TITLE_NOUN[energy]}`,
    segments,
    restSec,
    getReadySec: GET_READY_SEC,
    totalDurationSec: segments.reduce((a, s) => a + s.durationSec, 0) + restSec * (segments.length - 1),
    exclusionLabels: exclusionLabels(profile),
    generatedLocally: true,
    seed,
  };
}

function sequence(candidates: Exercise[], n: number, target: number, seed: number, ceiling: number): string[] {
  const rng = createRng(seed);
  const used = new Map<string, number>();
  const ids: string[] = [];
  let prev: Exercise | null = null;

  for (let slot = 0; slot < n; slot++) {
    const aim = slot === 0 ? target - 1.5 : target;
    let pick: Exercise | null = null;
    let bestCost = Infinity;
    for (const ex of candidates) {
      let cost = Math.abs(ex.intensity - aim);
      if (prev && ex.id === prev.id) cost += 10;
      if (prev && ex.family === prev.family) cost += 2;
      // A penalty, not a filter, so every candidate still consumes the same random draws.
      if (ex.intensity > ceiling) cost += 5;
      cost += 1.5 * (used.get(ex.id) ?? 0);
      cost += rng() * VARIETY;
      if (cost < bestCost) {
        bestCost = cost;
        pick = ex;
      }
    }
    const chosen = pick as Exercise;
    ids.push(chosen.id);
    used.set(chosen.id, (used.get(chosen.id) ?? 0) + 1);
    prev = chosen;
  }
  return ids;
}

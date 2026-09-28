/**
 * The live session, as a pure reducer.
 *
 *   getready → active ⇄ adapting → rest → active … → complete
 *
 * Time advances only through TICK events, so the same reducer drives the TV at wall-clock
 * speed and `tools/sim` at thousands of times real speed. Nothing here reads a clock,
 * touches a network, or knows which screen is showing.
 *
 * Two routes into `adapting`, and the TV must make them look different (TV-9 vs TV-8):
 *   predicted-strain  the model reached its threshold on its own     → "I noticed"
 *   user-correction   the person said "easier" (or pressed it)       → "I learned"
 */

import { eligibilityFor } from './contraindications.js';
import { blocksFrom } from './generator.js';
import { getExercise, harderThan, resolveAlternatives } from './graph.js';
import { learnFromCorrection } from './learning.js';
import {
  ADAPT_DROP,
  CONFIDENCE_FLOOR,
  effectiveQuality,
  mayAutoAdapt,
  project,
  stepStrain,
  threshold,
  type Projection,
} from './strain.js';
import { adaptationReason, learningCopy, type LearningCopy } from './text.js';
import type {
  Adaptation,
  AdaptationAction,
  AdaptationTrigger,
  Correction,
  CorrectionDirection,
  CorrectionSource,
  Energy,
  ExerciseGraph,
  LearningOutcome,
  Profile,
  QualityFrame,
  SessionPhase,
  SessionPlan,
  SessionSegment,
  StrainPoint,
} from './types.js';

/** How long the TV-9 decision panel holds before the new movement starts ("STARTING IN 3"). */
export const ADAPTING_SEC = 3;

/** Smoothing time constant for incoming quality frames. */
export const QUALITY_TAU_SEC = 3;

/** Strain series resolution for the TV-10 timeline. */
const SERIES_EVERY_SEC = 2;

/** Integration step cap — large TICKs are split so the physics stays accurate. */
const MAX_STEP_SEC = 0.5;

export interface SessionContext {
  graph: ExerciseGraph;
  profile: Profile;
  energy: Energy;
}

export interface SessionState {
  phase: SessionPhase;
  plan: SessionPlan;
  /** The live threshold. Fixed for the session; learning changes it next time. */
  T: number;
  segmentIndex: number;
  segmentElapsedSec: number;
  /** Countdown for getready / rest / adapting. */
  phaseRemainingSec: number;
  /** Seconds since the first rep, including rests. Excludes get-ready. */
  sessionElapsedSec: number;
  currentExerciseId: string;
  strain: number;
  strainSeries: StrainPoint[];
  /** Smoothed movement quality for the current exercise, or null before any frame. */
  quality: number | null;
  confidence: number;
  measuredCadence: number | null;
  lastFrameT: number | null;
  repsThisSegment: number;
  totalReps: number;
  adaptations: Adaptation[];
  corrections: Correction[];
  learning: LearningOutcome[];
  /** The bias the NEXT session will use. Moves with each correction. */
  bias: number;
  lastAdaptationAtSec: number | null;
  /** The decision being shown while `phase === 'adapting'`. */
  pending: Adaptation | null;
  nextSeriesAtSec: number;
}

export type SessionEvent =
  | { type: 'TICK'; dtSec: number }
  | { type: 'QUALITY'; frame: QualityFrame }
  | { type: 'CORRECTION'; direction: CorrectionDirection; source: CorrectionSource; heard?: string }
  | { type: 'SKIP' }
  /** The phone went away. Its last reading must not keep steering the model. */
  | { type: 'SENSOR_LOST' };

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createSession(ctx: SessionContext, plan: SessionPlan): SessionState {
  const first = plan.segments[0];
  if (!first) throw new Error('A session plan needs at least one segment');
  return {
    phase: 'getready',
    plan,
    T: threshold(ctx.profile, ctx.energy),
    segmentIndex: 0,
    segmentElapsedSec: 0,
    phaseRemainingSec: plan.getReadySec,
    sessionElapsedSec: 0,
    currentExerciseId: first.exerciseId,
    strain: 0,
    strainSeries: [{ t: 0, s: 0 }],
    quality: null,
    confidence: 0,
    measuredCadence: null,
    lastFrameT: null,
    repsThisSegment: 0,
    totalReps: 0,
    adaptations: [],
    corrections: [],
    learning: [],
    bias: ctx.profile.personalBias,
    lastAdaptationAtSec: null,
    pending: null,
    nextSeriesAtSec: SERIES_EVERY_SEC,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(ctx: SessionContext, state: SessionState, event: SessionEvent): SessionState {
  if (state.phase === 'complete') return state;
  switch (event.type) {
    case 'TICK':
      return tick(ctx, state, event.dtSec);
    case 'QUALITY':
      return onQuality(ctx, state, event.frame);
    case 'CORRECTION':
      return onCorrection(ctx, state, event.direction, event.source, event.heard);
    case 'SKIP':
      return state.phase === 'active' ? endSegment(state) : state;
    case 'SENSOR_LOST':
      return { ...state, ...freshSignal() };
  }
}

function currentSegment(s: SessionState): SessionSegment {
  return s.plan.segments[s.segmentIndex] as SessionSegment;
}

function isLastSegment(s: SessionState): boolean {
  return s.segmentIndex >= s.plan.segments.length - 1;
}

function sessionRemainingSec(ctx: SessionContext, s: SessionState): number {
  const blocks = blocksFrom(
    s.plan,
    ctx.graph,
    s.segmentIndex,
    s.segmentElapsedSec,
    s.phase === 'rest',
    s.phaseRemainingSec,
    s.currentExerciseId,
  );
  return blocks.reduce((a, b) => a + b.durationSec, 0);
}

function record(s: SessionState): SessionState {
  if (s.sessionElapsedSec < s.nextSeriesAtSec) return s;
  return {
    ...s,
    strainSeries: [...s.strainSeries, { t: s.sessionElapsedSec, s: s.strain }],
    nextSeriesAtSec: s.nextSeriesAtSec + SERIES_EVERY_SEC,
  };
}

function tick(ctx: SessionContext, state: SessionState, dtSec: number): SessionState {
  let s = state;
  let remaining = Math.max(0, dtSec);

  while (remaining > 1e-9 && s.phase !== 'complete') {
    let step = Math.min(remaining, MAX_STEP_SEC);

    if (s.phase === 'getready') {
      step = Math.min(step, s.phaseRemainingSec);
      const left = s.phaseRemainingSec - step;
      s = left <= 1e-9 ? { ...s, phase: 'active', phaseRemainingSec: 0 } : { ...s, phaseRemainingSec: left };
    } else if (s.phase === 'active') {
      const seg = currentSegment(s);
      step = Math.min(step, Math.max(0, seg.durationSec - s.segmentElapsedSec));
      if (step <= 1e-9) {
        s = endSegment(s);
        continue;
      }
      const ex = getExercise(ctx.graph, s.currentExerciseId);
      const q = effectiveQuality(s.quality, s.confidence);
      const cadence = s.measuredCadence !== null && s.confidence >= CONFIDENCE_FLOOR ? s.measuredCadence : ex.expectedCadence ?? 0;
      const reps = (cadence * step) / 60;
      s = record({
        ...s,
        strain: stepStrain(s.strain, step, { working: true, intensity: ex.intensity, T: s.T, quality: q }),
        segmentElapsedSec: s.segmentElapsedSec + step,
        sessionElapsedSec: s.sessionElapsedSec + step,
        repsThisSegment: s.repsThisSegment + reps,
        totalReps: s.totalReps + reps,
      });

      if (
        s.strain >= s.T &&
        mayAutoAdapt({
          sessionElapsedSec: s.sessionElapsedSec,
          sessionRemainingSec: sessionRemainingSec(ctx, s),
          lastAdaptationAtSec: s.lastAdaptationAtSec,
          completedSegments: s.segmentIndex,
        })
      ) {
        s = beginAdaptation(ctx, s, 'predicted-strain', 'easier');
      } else if (s.segmentElapsedSec >= seg.durationSec - 1e-9) {
        s = endSegment(s);
      }
    } else if (s.phase === 'rest') {
      step = Math.min(step, s.phaseRemainingSec);
      s = record({
        ...s,
        strain: stepStrain(s.strain, step, { working: false, intensity: 0, T: s.T, quality: 1 }),
        sessionElapsedSec: s.sessionElapsedSec + step,
        phaseRemainingSec: s.phaseRemainingSec - step,
      });
      if (s.phaseRemainingSec <= 1e-9) s = startNextSegment(s);
    } else if (s.phase === 'adapting') {
      // The decision panel holds; the segment clock pauses and no strain accrues.
      step = Math.min(step, s.phaseRemainingSec);
      s = { ...s, sessionElapsedSec: s.sessionElapsedSec + step, phaseRemainingSec: s.phaseRemainingSec - step };
      if (s.phaseRemainingSec <= 1e-9) s = finishAdaptation(s);
    }

    remaining -= step;
  }
  return s;
}

function endSegment(s: SessionState): SessionState {
  if (isLastSegment(s)) {
    return { ...s, phase: 'complete', strainSeries: [...s.strainSeries, { t: s.sessionElapsedSec, s: s.strain }] };
  }
  return { ...s, phase: 'rest', phaseRemainingSec: s.plan.restSec };
}

function startNextSegment(s: SessionState): SessionState {
  const index = s.segmentIndex + 1;
  const seg = s.plan.segments[index] as SessionSegment;
  return {
    ...s,
    phase: 'active',
    segmentIndex: index,
    segmentElapsedSec: 0,
    phaseRemainingSec: 0,
    currentExerciseId: seg.exerciseId,
    repsThisSegment: 0,
    ...freshSignal(),
  };
}

/** A new movement has a new signal shape — its quality must be re-baselined, not carried over. */
function freshSignal() {
  return { quality: null, confidence: 0, measuredCadence: null, lastFrameT: null };
}

// ---------------------------------------------------------------------------
// Adaptation
// ---------------------------------------------------------------------------

function beginAdaptation(
  ctx: SessionContext,
  s: SessionState,
  trigger: AdaptationTrigger,
  direction: CorrectionDirection,
): SessionState {
  const eligible = eligibilityFor(ctx.profile);
  let target: string | null = null;
  if (direction === 'easier') {
    target = resolveAlternatives(ctx.graph, s.currentExerciseId, eligible).easier?.id ?? null;
  } else {
    const up = harderThan(ctx.graph, s.currentExerciseId);
    target = up && eligible(up) ? up.id : null;
  }

  // Asking for harder at the top of a ladder changes nothing on screen; it is still learned.
  if (direction === 'harder' && target === null) return s;

  const action: AdaptationAction = target ? 'switch' : 'end-segment';
  const strainAfter = direction === 'easier' ? s.strain * ADAPT_DROP : s.strain;
  const quality = s.confidence >= CONFIDENCE_FLOOR ? s.quality : null;

  const adaptation: Adaptation = {
    atSec: s.sessionElapsedSec,
    segmentElapsedSec: s.segmentElapsedSec,
    trigger,
    action,
    fromExerciseId: s.currentExerciseId,
    toExerciseId: target ?? s.currentExerciseId,
    reason: adaptationReason({ trigger, action, sessionElapsedSec: s.sessionElapsedSec, quality }),
    strainBefore: s.strain,
    strainAfter,
  };

  return {
    ...s,
    phase: 'adapting',
    phaseRemainingSec: ADAPTING_SEC,
    strain: strainAfter,
    strainSeries: [
      ...s.strainSeries,
      { t: s.sessionElapsedSec, s: s.strain },
      { t: s.sessionElapsedSec, s: strainAfter },
    ],
    adaptations: [...s.adaptations, adaptation],
    lastAdaptationAtSec: s.sessionElapsedSec,
    pending: adaptation,
  };
}

function finishAdaptation(s: SessionState): SessionState {
  const a = s.pending;
  const base = { ...s, pending: null, phaseRemainingSec: 0 };
  if (!a || a.action === 'end-segment') return endSegment({ ...base, phase: 'active' });
  return { ...base, phase: 'active', currentExerciseId: a.toExerciseId, ...freshSignal() };
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

function onQuality(ctx: SessionContext, s: SessionState, frame: QualityFrame): SessionState {
  if (s.phase !== 'active') return s;
  // Frames from the previous movement arrive late after a switch. Ignore them.
  if (frame.profile !== getExercise(ctx.graph, s.currentExerciseId).signalProfile) return s;

  const dt = s.lastFrameT === null ? 0.5 : Math.max(0, frame.t - s.lastFrameT);
  const alpha = 1 - Math.exp(-dt / QUALITY_TAU_SEC);
  const trusted = frame.confidence >= CONFIDENCE_FLOOR;
  const quality = !trusted ? s.quality : s.quality === null ? frame.quality : s.quality + alpha * (frame.quality - s.quality);

  return {
    ...s,
    quality,
    confidence: frame.confidence,
    measuredCadence: trusted ? frame.cadence : s.measuredCadence,
    lastFrameT: frame.t,
  };
}

function onCorrection(
  ctx: SessionContext,
  s: SessionState,
  direction: CorrectionDirection,
  source: CorrectionSource,
  heard?: string,
): SessionState {
  if (s.phase !== 'active') return s;

  const correction: Correction =
    heard !== undefined ? { atSec: s.sessionElapsedSec, direction, source, heard } : { atSec: s.sessionElapsedSec, direction, source };

  // When did the model expect to act? Asked from the live state, before anything changes.
  const p = projectionFor(ctx, s);
  const predictedAtSec = p.secondsUntilThreshold === null ? null : s.sessionElapsedSec + p.secondsUntilThreshold;

  const outcome = learnFromCorrection({
    direction,
    atSec: s.sessionElapsedSec,
    predictedAtSec,
    sessionDurationSec: s.plan.totalDurationSec,
    bias: s.bias,
    strain: s.strain,
    populationThreshold: s.T / ctx.profile.personalBias,
  });

  const learned: SessionState = {
    ...s,
    corrections: [...s.corrections, correction],
    learning: [...s.learning, outcome],
    bias: outcome.biasAfter,
  };
  // User corrections bypass the auto-adapt gates — the person is always in control.
  return beginAdaptation(ctx, learned, 'user-correction', direction);
}

// ---------------------------------------------------------------------------
// Selectors for the screens
// ---------------------------------------------------------------------------

/** The forecast behind TV-7's dashed curve and "ADAPTS IN ~N MIN". */
export function projectionFor(ctx: SessionContext, s: SessionState): Projection {
  const blocks = blocksFrom(
    s.plan,
    ctx.graph,
    s.segmentIndex,
    s.segmentElapsedSec,
    s.phase === 'rest',
    s.phaseRemainingSec,
    s.currentExerciseId,
  );
  return project(s.strain, s.T, blocks, effectiveQuality(s.quality, s.confidence));
}

export interface SessionSummary {
  durationSec: number;
  totalReps: number;
  adaptations: Adaptation[];
  adaptedExerciseNames: string[];
  strainSeries: StrainPoint[];
  threshold: number;
  learning: LearningCopy | null;
  biasBefore: number;
  biasAfter: number;
}

/** Everything TV-10 needs. The learning card is present only if the person corrected the model. */
export function summaryFor(ctx: SessionContext, s: SessionState): SessionSummary {
  const lastEasier = [...s.learning].reverse().find((l) => l.direction === 'easier') ?? s.learning[s.learning.length - 1] ?? null;
  return {
    durationSec: Math.round(s.sessionElapsedSec),
    totalReps: Math.round(s.totalReps),
    adaptations: s.adaptations,
    adaptedExerciseNames: s.adaptations.map((a) => getExercise(ctx.graph, a.fromExerciseId).name),
    strainSeries: s.strainSeries,
    threshold: s.T,
    learning: learningCopy(lastEasier),
    biasBefore: ctx.profile.personalBias,
    biasAfter: s.bias,
  };
}

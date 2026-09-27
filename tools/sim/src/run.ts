/**
 * One simulated session, sample by sample.
 *
 * At 50 Hz: synthesise a floor-vibration sample for whatever the person is doing, push it
 * through the real QualityEstimator, emit a QualityFrame every half second, and advance
 * the real session reducer. Nothing is stubbed between the sensor and the adaptation.
 */

import {
  createSession,
  generatePlan,
  getExercise,
  hashString,
  QualityEstimator,
  reduce,
  SAMPLE_RATE,
  summaryFor,
  synthesizeTrace,
  type Energy,
  type Exercise,
  type ExerciseGraph,
  type Profile,
  type SensorSample,
  type SessionContext,
  type SessionEvent,
  type SessionPlan,
  type SessionState,
  type SessionSummary,
} from '@adapt/core';

/** How a simulated person's movement holds up. */
export type UserModel = 'fading' | 'strong';

/**
 * A fading person loses landing strength and rhythm faster on harder movements and later
 * in the session. A strong person holds form throughout. Both are caricatures; Phase 5
 * replaces them with recordings of a real floor.
 */
function fadeFor(user: UserModel, ex: Exercise, sessionElapsedAtStart: number): (t: number) => number {
  if (user === 'strong') return () => 1;
  const perMin = Math.max(0, ex.intensity - 3.5) * 0.06 * (1 + sessionElapsedAtStart / 300);
  return (t) => Math.max(0.35, 1 - (perMin * t) / 60);
}

export interface RunOptions {
  graph: ExerciseGraph;
  profile: Profile;
  energy: Energy;
  durationMin: number;
  seed: number;
  paired: boolean;
  user: UserModel;
  /** Called every tick; returns a correction when the scripted person speaks. */
  speak?: (state: SessionState, ctx: SessionContext) => SessionEvent | null;
}

export interface RunResult {
  plan: SessionPlan;
  state: SessionState;
  summary: SessionSummary;
  ctx: SessionContext;
}

export function runSession(opts: RunOptions): RunResult {
  const { graph, profile, energy, durationMin, seed, paired, user } = opts;
  const plan = generatePlan({ graph, profile, durationMin, energy, seed });
  const ctx: SessionContext = { graph, profile, energy };
  let s = createSession(ctx, plan);

  const dt = 1 / SAMPLE_RATE;
  const framesEvery = SAMPLE_RATE / 2;
  const estimator = new QualityEstimator({ profile: 'impact' });
  let trace: SensorSample[] = [];
  let traceIndex = 0;
  let traceKey = '';
  let sampleCount = 0;
  let guard = 0;

  while (s.phase !== 'complete' && guard++ < 5_000_000) {
    if (paired && s.phase === 'active') {
      const key = `${s.segmentIndex}:${s.currentExerciseId}`;
      if (key !== traceKey) {
        traceKey = key;
        const ex = getExercise(graph, s.currentExerciseId);
        const fade = fadeFor(user, ex, s.sessionElapsedSec);
        estimator.reset(ex.signalProfile, ex.expectedCadence);
        trace = synthesizeTrace({
          profile: ex.signalProfile,
          durationSec: 400,
          cadencePerMin: ex.expectedCadence ?? 60,
          fade,
          jitter: (t) => 0.04 + 0.12 * (1 - fade(t)),
          pace: (t) => 1 - 0.15 * (1 - fade(t)),
          seed: hashString(key) ^ seed,
        });
        traceIndex = 0;
      }
      const sample = trace[traceIndex++];
      if (sample) estimator.push(sample);
      if (++sampleCount % framesEvery === 0) s = reduce(ctx, s, { type: 'QUALITY', frame: estimator.frame() });
    }

    const said = opts.speak?.(s, ctx) ?? null;
    if (said) s = reduce(ctx, s, said);

    s = reduce(ctx, s, { type: 'TICK', dtSec: dt });
  }

  return { plan, state: s, summary: summaryFor(ctx, s), ctx };
}

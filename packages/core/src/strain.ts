/**
 * The strain model — the heart of ADAPT.
 *
 * The system does not wait to be told a workout is too hard. It accumulates *strain* —
 * intensity integrated over time — and weighs it against a threshold built from the
 * profile. When strain reaches the threshold, the workout adapts on its own.
 *
 *   dS/dt = LOAD_RATE · intensity · fatigue(S) · qualityPenalty(q)      while working
 *   dS/dt = −RECOVERY_RATE                                              while resting
 *
 *   fatigue(S)        = 1 + FATIGUE_COEFF · S/T        later work costs more
 *   qualityPenalty(q) = 1 + QUALITY_COEFF · (1 − q)    struggling costs more
 *
 *   T = T_BASE[energy] · ageFactor(age) · PREFERENCE[pref] · personalBias^share
 *
 * Strain is in arbitrary units. None of these constants is a physiological measurement;
 * they are chosen so a 12-minute steady session reaches its threshold in its final third,
 * and `tools/sim` is the rig they were tuned on. What matters is the *shape*: strain
 * climbs, climbs faster as it accumulates and as movement degrades, eases during rests,
 * and the threshold moves when the person corrects the model.
 */

import type { Energy, IntensityPreference, Profile } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Strain units per minute of work at intensity 1, before fatigue and quality.
 *
 * Tuned so a medium-energy 12-minute plan reaches its threshold on *moderate* movements
 * (intensity ~6: Jumping Jacks, High Knees, Skater Hops). Lower, and the generator has to
 * reach for burpees and split jumps to get anywhere near the threshold — a "Cardio Reset"
 * made entirely of the hardest movements in the pool.
 */
export const LOAD_RATE = 2.2;

/** How much accumulated strain inflates the cost of further work. At S = T, work costs 35% more. */
export const FATIGUE_COEFF = 0.35;

/** How much degraded movement inflates cost. At quality 0.5, work costs 30% more. */
export const QUALITY_COEFF = 0.6;

/** Strain shed per minute of rest. A 20 s rest sheds ~2 units — rests matter, but don't reset you. */
export const RECOVERY_RATE = 6;

/** Threshold before profile adjustments, by stated energy. */
export const T_BASE: Record<Energy, number> = { low: 55, medium: 80, high: 110 };

/** A stated preference for harder work raises the ceiling; a gentle one lowers it. */
export const PREFERENCE: Record<IntensityPreference, number> = { gentle: 0.85, steady: 1.0, hard: 1.15 };

/** On adaptation, strain drops by this factor — the sawtooth on TV-10. */
export const ADAPT_DROP = 0.7;

/** No two automatic adaptations closer than this. Prevents flapping on noisy signal. */
export const COOLDOWN_SEC = 45;

/** No automatic adaptation this close to the end — there is nothing left to protect. */
export const FINAL_QUIET_SEC = 20;

/** Below this confidence, quality is treated as nominal (1.0) rather than trusted. */
export const CONFIDENCE_FLOOR = 0.5;

/**
 * How much of the learned bias the *plan* absorbs. The live threshold applies all of it.
 *
 * This has to stay small, and the reason is worth writing down because the simulator
 * caught it: the generator sizes each plan to reach its threshold two-thirds of the way
 * through. If the plan absorbed the whole bias, it would simply re-plan a lighter session
 * that reaches the lower threshold at the same moment — cancelling the learning, and
 * making "adapts sooner" false. At 0.25, a bias of 0.88 makes the next plan ~3% lighter
 * while the live threshold is 12% lower: "Next session starts lighter and adapts sooner",
 * both literally true, and the second one visible.
 */
export const PLAN_BIAS_SHARE = 0.25;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

/** Younger bodies get a little more headroom, older a little less, within a narrow band. */
export function ageFactor(ageYears: number): number {
  return clamp(1.15 - 0.005 * (ageYears - 30), 0.75, 1.15);
}

/**
 * The strain ceiling for this person today.
 *
 * `biasShare` = 1 for the live threshold during a session; PLAN_BIAS_SHARE when the
 * generator is sizing a plan.
 */
export function threshold(profile: Profile, energy: Energy, biasShare = 1): number {
  return (
    T_BASE[energy] *
    ageFactor(profile.ageYears) *
    PREFERENCE[profile.intensityPreference] *
    Math.pow(profile.personalBias, biasShare)
  );
}

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------

/** Quality the model should act on: measured when trustworthy, nominal otherwise. */
export function effectiveQuality(quality: number | null, confidence: number): number {
  if (quality === null || confidence < CONFIDENCE_FLOOR) return 1;
  return clamp(quality, 0, 1);
}

/** Strain per second while working. */
export function workRate(intensity: number, strain: number, T: number, quality: number): number {
  const fatigue = 1 + FATIGUE_COEFF * (strain / T);
  const penalty = 1 + QUALITY_COEFF * (1 - quality);
  return (LOAD_RATE * intensity * fatigue * penalty) / 60;
}

export interface StepInput {
  working: boolean;
  intensity: number;
  T: number;
  quality: number;
}

export function stepStrain(strain: number, dtSec: number, input: StepInput): number {
  if (!input.working) return Math.max(0, strain - (RECOVERY_RATE / 60) * dtSec);
  return strain + workRate(input.intensity, strain, input.T, input.quality) * dtSec;
}

// ---------------------------------------------------------------------------
// Projection — "ADAPTS IN ~2 MIN"
// ---------------------------------------------------------------------------

/** A span of the remaining session: work at an intensity, or rest. */
export interface Block {
  kind: 'work' | 'rest';
  durationSec: number;
  intensity: number;
}

export interface Projection {
  /** Seconds from now until strain reaches the threshold, or null if it won't this session. */
  secondsUntilThreshold: number | null;
  /** Projected strain at the end of the session if nothing adapts. */
  finalStrain: number;
  /** Sampled future curve for the dashed projection on TV-7. */
  curve: Array<{ dt: number; s: number }>;
}

/**
 * Forward-integrate the rest of the session at the current quality.
 *
 * This is a forecast, not a progress bar: it moves every time quality moves, and it is
 * why the TV-7 curve is drawn as a dashed line heading toward a ceiling rather than a bar
 * filling to 100.
 */
export function project(
  strain: number,
  T: number,
  blocks: Block[],
  quality: number,
  stepSec = 1,
  sampleEverySec = 5,
): Projection {
  let s = strain;
  let t = 0;
  let crossing: number | null = s >= T ? 0 : null;
  const curve: Array<{ dt: number; s: number }> = [{ dt: 0, s }];
  let nextSample = sampleEverySec;

  for (const b of blocks) {
    let remaining = b.durationSec;
    while (remaining > 1e-9) {
      const dt = Math.min(stepSec, remaining);
      s = stepStrain(s, dt, { working: b.kind === 'work', intensity: b.intensity, T, quality });
      t += dt;
      remaining -= dt;
      if (crossing === null && s >= T) crossing = t;
      if (t >= nextSample) {
        curve.push({ dt: t, s });
        nextSample += sampleEverySec;
      }
    }
  }
  if (curve[curve.length - 1]?.dt !== t) curve.push({ dt: t, s });

  return { secondsUntilThreshold: crossing, finalStrain: s, curve };
}

// ---------------------------------------------------------------------------
// Gating
// ---------------------------------------------------------------------------

export interface GateInput {
  sessionElapsedSec: number;
  sessionRemainingSec: number;
  lastAdaptationAtSec: number | null;
  completedSegments: number;
}

/**
 * Whether the model may act on its own right now. User corrections bypass this — the
 * person is always in control — but the model does not act on its own when doing so would
 * flap, would fire before it has seen a full segment, or would fire with nothing left to
 * protect.
 */
export function mayAutoAdapt(g: GateInput): boolean {
  if (g.completedSegments < 1) return false;
  if (g.sessionRemainingSec <= FINAL_QUIET_SEC) return false;
  if (g.lastAdaptationAtSec !== null && g.sessionElapsedSec - g.lastAdaptationAtSec < COOLDOWN_SEC) {
    return false;
  }
  return true;
}

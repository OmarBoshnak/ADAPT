// dS/dt = LOAD_RATE · intensity · fatigue(S) · qualityPenalty(q) while working, −RECOVERY_RATE while resting.
// T = T_BASE[energy] · ageFactor · PREFERENCE · personalBias^share. Units are arbitrary; tuned with tools/sim.

import type { Energy, IntensityPreference, Profile } from './types.js';

// Lower forces the generator onto burpees and split jumps to reach a medium threshold.
export const LOAD_RATE = 2.2;

export const FATIGUE_COEFF = 0.35;

export const QUALITY_COEFF = 0.6;

export const RECOVERY_RATE = 6;

export const T_BASE: Record<Energy, number> = { low: 55, medium: 80, high: 110 };

export const PREFERENCE: Record<IntensityPreference, number> = { gentle: 0.85, steady: 1.0, hard: 1.15 };

export const ADAPT_DROP = 0.7;

export const COOLDOWN_SEC = 45;

export const FINAL_QUIET_SEC = 20;

export const CONFIDENCE_FLOOR = 0.5;

// Share of the learned bias the plan absorbs. Higher and the generator re-plans the learning away.
export const PLAN_BIAS_SHARE = 0.25;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function ageFactor(ageYears: number): number {
  return clamp(1.15 - 0.005 * (ageYears - 30), 0.75, 1.15);
}

/** `biasShare` is 1 live and PLAN_BIAS_SHARE when sizing a plan. */
export function threshold(profile: Profile, energy: Energy, biasShare = 1): number {
  return (
    T_BASE[energy] *
    ageFactor(profile.ageYears) *
    PREFERENCE[profile.intensityPreference] *
    Math.pow(profile.personalBias, biasShare)
  );
}

export function effectiveQuality(quality: number | null, confidence: number): number {
  if (quality === null || confidence < CONFIDENCE_FLOOR) return 1;
  return clamp(quality, 0, 1);
}

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

export interface Block {
  kind: 'work' | 'rest';
  durationSec: number;
  intensity: number;
}

export interface Projection {
  secondsUntilThreshold: number | null;
  finalStrain: number;
  curve: Array<{ dt: number; s: number }>;
}

/** Forward-integrates the remaining blocks at the current quality. */
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

export interface GateInput {
  sessionElapsedSec: number;
  sessionRemainingSec: number;
  lastAdaptationAtSec: number | null;
  completedSegments: number;
}

/** Gates automatic adaptation only; user corrections always go through. */
export function mayAutoAdapt(g: GateInput): boolean {
  if (g.completedSegments < 1) return false;
  if (g.sessionRemainingSec <= FINAL_QUIET_SEC) return false;
  if (g.lastAdaptationAtSec !== null && g.sessionElapsedSec - g.lastAdaptationAtSec < COOLDOWN_SEC) {
    return false;
  }
  return true;
}

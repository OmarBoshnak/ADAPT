// A correction is a measurement: the strain held when the person asked estimates their real limit.
// The bias moves toward that estimate rather than stepping multiplicatively, which overshot to the floor.

import type { CorrectionDirection, LearningOutcome } from './types.js';

export const LEARNING_RATE = 0.8;

// Aim just under the observed limit so the model, once learned, acts before the person asks.
export const SAFETY_MARGIN = 0.03;
export const MAX_STEP = 0.2;
export const HARDER_NUDGE = 0.05;
export const BIAS_MIN = 0.6;
export const BIAS_MAX = 1.4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface CorrectionInput {
  direction: CorrectionDirection;
  atSec: number;
  predictedAtSec: number | null;
  sessionDurationSec: number;
  bias: number;
  strain: number;
  /** Threshold with bias = 1. */
  populationThreshold: number;
}

export function learnFromCorrection(input: CorrectionInput): LearningOutcome {
  const { direction, atSec, predictedAtSec, sessionDurationSec, bias, strain, populationThreshold } = input;

  const expected = predictedAtSec ?? sessionDurationSec;
  const earlySec = Math.max(0, expected - atSec);

  if (direction === 'harder') {
    return {
      direction,
      atSec,
      predictedAtSec,
      earlySec: 0,
      biasBefore: bias,
      biasAfter: clamp(bias * (1 + HARDER_NUDGE), BIAS_MIN, BIAS_MAX),
    };
  }

  const implied = populationThreshold > 0 ? (strain / populationThreshold) * (1 - SAFETY_MARGIN) : bias;
  const target = Math.min(implied, bias);
  const moved = bias + LEARNING_RATE * (target - bias);
  const floor = bias * (1 - MAX_STEP);

  return {
    direction,
    atSec,
    predictedAtSec,
    earlySec,
    biasBefore: bias,
    biasAfter: clamp(Math.max(moved, floor), BIAS_MIN, BIAS_MAX),
  };
}

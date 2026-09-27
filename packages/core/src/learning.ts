/**
 * The learning loop.
 *
 * A spoken "easier" is not just a command — it is a correction, and it carries a
 * measurement: the strain the person had accumulated at the moment they asked. That is an
 * estimate of their real limit. The model moves its belief toward it:
 *
 *   implied = (strain_at_ask / population_threshold) · (1 − SAFETY_MARGIN)
 *   target  = min(implied, bias)                          "easier" can only lower the ceiling
 *   bias   ← bias + LEARNING_RATE · (target − bias)
 *
 * In words: "you needed easier at 80% of the load I'd assume for someone like you, so I'll
 * move most of the way toward acting just before that point."
 *
 * Why an estimate rather than a multiplicative step: three corrections at the same load are
 * the same evidence three times, not three times the evidence. A multiplicative rule
 * compounds them and overshoots — the simulator caught exactly that, driving a person whose
 * real limit was 80% down to the 60% floor, where the model then held them back forever
 * because they never again needed to ask. Moving toward an estimate converges on the
 * person's real limit and cannot pass it. `npm run sim -- converge` is the regression test.
 *
 * Why strain rather than time: two people can ask at the same minute for different reasons.
 * What the model got wrong is how much load this person can hold, and strain measures load.
 *
 * Guard rails: one correction can lower the ceiling by at most MAX_STEP of its current
 * value, and the bias stays within [BIAS_MIN, BIAS_MAX], so one misheard word can never
 * distort the model beyond recovery. "Harder" raises the ceiling by a fixed nudge — it has
 * no shortfall to measure.
 *
 * `earlySec` is still recorded: it is what the TV-10 card says out loud ("You asked for
 * easier one minute before I expected it"), because minutes are how people think.
 */

import type { CorrectionDirection, LearningOutcome } from './types.js';

export const LEARNING_RATE = 0.8;

/**
 * The model aims slightly BELOW the limit it observed, not at it. Aiming exactly at it
 * converges from above — the model always arrives a moment after the person would have
 * asked, so they never stop needing to ask. 3% below means that, once learned, the model
 * steps in first and the person does not have to say anything at all.
 */
export const SAFETY_MARGIN = 0.03;
export const MAX_STEP = 0.2;
export const HARDER_NUDGE = 0.05;
export const BIAS_MIN = 0.6;
export const BIAS_MAX = 1.4;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface CorrectionInput {
  direction: CorrectionDirection;
  atSec: number;
  /** When the model expected to adapt, in session seconds; null if it did not expect to. */
  predictedAtSec: number | null;
  sessionDurationSec: number;
  /** The model's current belief, including any corrections earlier this session. */
  bias: number;
  /** Strain accumulated at the moment of the correction. */
  strain: number;
  /** The threshold for this profile and energy with no learning applied (bias = 1). */
  populationThreshold: number;
}

export function learnFromCorrection(input: CorrectionInput): LearningOutcome {
  const { direction, atSec, predictedAtSec, sessionDurationSec, bias, strain, populationThreshold } = input;

  // No predicted adaptation this session means the model expected the person to finish
  // without one — so the correction arrived early relative to the end of the session.
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

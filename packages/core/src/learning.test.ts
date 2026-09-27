import { describe, expect, it } from 'vitest';

import {
  BIAS_MAX,
  BIAS_MIN,
  HARDER_NUDGE,
  learnFromCorrection,
  MAX_STEP,
  SAFETY_MARGIN,
  type CorrectionInput,
} from './learning.js';

const T_POP = 100;

const easier = (p: Partial<CorrectionInput> = {}): CorrectionInput => ({
  direction: 'easier',
  atSec: 300,
  predictedAtSec: 480,
  sessionDurationSec: 720,
  bias: 1,
  strain: 80,
  populationThreshold: T_POP,
  ...p,
});

describe('learnFromCorrection — easier', () => {
  it('lowers the ceiling when the person asked below it', () => {
    const o = learnFromCorrection(easier());
    expect(o.biasAfter).toBeLessThan(o.biasBefore);
  });

  it('never raises the ceiling, even if asked above it', () => {
    const o = learnFromCorrection(easier({ strain: 130 }));
    expect(o.biasAfter).toBeLessThanOrEqual(o.biasBefore);
  });

  it('moves further the further below the ceiling they asked', () => {
    const near = learnFromCorrection(easier({ strain: 95 })).biasAfter;
    const far = learnFromCorrection(easier({ strain: 85 })).biasAfter;
    expect(far).toBeLessThan(near);
  });

  it('caps a single correction — one misheard word cannot wreck the model', () => {
    const o = learnFromCorrection(easier({ strain: 1 }));
    expect(o.biasAfter).toBeCloseTo(1 - MAX_STEP, 6);
  });

  it('respects the absolute floor', () => {
    expect(learnFromCorrection(easier({ bias: BIAS_MIN, strain: 1 })).biasAfter).toBe(BIAS_MIN);
  });

  it('treats repeated identical evidence as the same evidence — no overshoot', () => {
    // The person's real limit is 80. They keep asking at 80. The belief must converge just
    // below 0.80 (the safety margin), never plunge to the floor.
    let bias = 1;
    for (let i = 0; i < 20; i++) {
      bias = learnFromCorrection(easier({ bias, strain: 80 })).biasAfter;
    }
    expect(bias).toBeCloseTo(0.8 * (1 - SAFETY_MARGIN), 3);
    expect(bias).toBeGreaterThan(BIAS_MIN);
  });

  it('records how early the ask was, for the TV-10 card', () => {
    expect(learnFromCorrection(easier({ atSec: 300, predictedAtSec: 480 })).earlySec).toBe(180);
    expect(learnFromCorrection(easier({ atSec: 500, predictedAtSec: 480 })).earlySec).toBe(0);
  });

  it('measures against the session end when no adaptation was expected', () => {
    expect(learnFromCorrection(easier({ atSec: 300, predictedAtSec: null })).earlySec).toBe(420);
  });

  it('holds its belief when there is no population threshold to measure against', () => {
    expect(learnFromCorrection(easier({ populationThreshold: 0 })).biasAfter).toBe(1);
  });
});

describe('learnFromCorrection — harder', () => {
  it('raises the ceiling by a fixed nudge', () => {
    const o = learnFromCorrection(easier({ direction: 'harder' }));
    expect(o.biasAfter).toBeCloseTo(1 + HARDER_NUDGE, 6);
    expect(o.earlySec).toBe(0);
  });

  it('respects the absolute ceiling', () => {
    expect(learnFromCorrection(easier({ direction: 'harder', bias: BIAS_MAX })).biasAfter).toBe(BIAS_MAX);
  });
});

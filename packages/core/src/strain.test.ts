import { describe, expect, it } from 'vitest';

import { fixtureProfile } from './graph.fixture.js';
import {
  ageFactor,
  COOLDOWN_SEC,
  effectiveQuality,
  FINAL_QUIET_SEC,
  mayAutoAdapt,
  PLAN_BIAS_SHARE,
  project,
  RECOVERY_RATE,
  stepStrain,
  threshold,
  workRate,
  type Block,
} from './strain.js';

describe('threshold', () => {
  it('rises with stated energy', () => {
    const p = fixtureProfile();
    expect(threshold(p, 'low')).toBeLessThan(threshold(p, 'medium'));
    expect(threshold(p, 'medium')).toBeLessThan(threshold(p, 'high'));
  });

  it('follows stated preference', () => {
    const at = (pref: 'gentle' | 'steady' | 'hard') => threshold(fixtureProfile({ intensityPreference: pref }), 'medium');
    expect(at('gentle')).toBeLessThan(at('steady'));
    expect(at('steady')).toBeLessThan(at('hard'));
  });

  it('moves with the learned bias, fully live and only partly for planning', () => {
    const base = threshold(fixtureProfile({ personalBias: 1 }), 'medium');
    const learned = fixtureProfile({ personalBias: 0.8 });
    expect(threshold(learned, 'medium')).toBeCloseTo(base * 0.8, 6);
    expect(threshold(learned, 'medium', PLAN_BIAS_SHARE)).toBeCloseTo(base * Math.pow(0.8, PLAN_BIAS_SHARE), 6);
    // the plan absorbs less than the live threshold — the reason "adapts sooner" stays true
    expect(threshold(learned, 'medium', PLAN_BIAS_SHARE)).toBeGreaterThan(threshold(learned, 'medium'));
  });

  it('ignores height and weight entirely', () => {
    const a = threshold(fixtureProfile({ heightCm: 150, weightKg: 50 }), 'medium');
    const b = threshold(fixtureProfile({ heightCm: 200, weightKg: 130 }), 'medium');
    expect(a).toBe(b);
  });
});

describe('ageFactor', () => {
  it('stays within a narrow band at the extremes', () => {
    expect(ageFactor(10)).toBe(1.15);
    expect(ageFactor(120)).toBe(0.75);
    expect(ageFactor(30)).toBeCloseTo(1.15, 6);
    expect(ageFactor(60)).toBeCloseTo(1.0, 6);
  });
});

describe('work rate', () => {
  it('costs more as strain accumulates', () => {
    expect(workRate(6, 50, 90, 1)).toBeGreaterThan(workRate(6, 0, 90, 1));
  });

  it('costs more as movement quality degrades', () => {
    expect(workRate(6, 20, 90, 0.5)).toBeGreaterThan(workRate(6, 20, 90, 1));
  });

  it('scales with intensity', () => {
    expect(workRate(8, 20, 90, 1)).toBeGreaterThan(workRate(4, 20, 90, 1));
  });
});

describe('stepStrain', () => {
  it('accumulates while working', () => {
    expect(stepStrain(10, 30, { working: true, intensity: 6, T: 90, quality: 1 })).toBeGreaterThan(10);
  });

  it('recovers while resting, but never below zero', () => {
    expect(stepStrain(10, 60, { working: false, intensity: 0, T: 90, quality: 1 })).toBeCloseTo(10 - RECOVERY_RATE, 6);
    expect(stepStrain(1, 600, { working: false, intensity: 0, T: 90, quality: 1 })).toBe(0);
  });
});

describe('effectiveQuality', () => {
  it('trusts quality only above the confidence floor', () => {
    expect(effectiveQuality(0.4, 1)).toBe(0.4);
    expect(effectiveQuality(0.4, 0.2)).toBe(1);
    expect(effectiveQuality(null, 1)).toBe(1);
    expect(effectiveQuality(1.7, 1)).toBe(1);
  });
});

describe('project', () => {
  const work = (durationSec: number, intensity: number): Block => ({ kind: 'work', durationSec, intensity });
  const rest = (durationSec: number): Block => ({ kind: 'rest', durationSec, intensity: 0 });

  it('finds the moment strain reaches the threshold', () => {
    const p = project(0, 20, [work(600, 6)], 1);
    expect(p.secondsUntilThreshold).not.toBeNull();
    expect(p.secondsUntilThreshold as number).toBeGreaterThan(0);
    expect(p.secondsUntilThreshold as number).toBeLessThan(600);
  });

  it('returns null when the session ends first', () => {
    expect(project(0, 1000, [work(60, 3)], 1).secondsUntilThreshold).toBeNull();
  });

  it('is zero when already at or past the threshold', () => {
    expect(project(95, 90, [work(60, 6)], 1).secondsUntilThreshold).toBe(0);
  });

  it('arrives sooner when quality is poorer — the forecast moves as the person moves', () => {
    const blocks = [work(300, 6), rest(20), work(300, 6)];
    const good = project(0, 60, blocks, 1).secondsUntilThreshold as number;
    const poor = project(0, 60, blocks, 0.4).secondsUntilThreshold as number;
    expect(poor).toBeLessThan(good);
  });

  it('samples a curve for the dashed projection, ending at the session end', () => {
    const p = project(0, 1000, [work(62, 5)], 1);
    expect(p.curve[0]).toEqual({ dt: 0, s: 0 });
    expect(p.curve[p.curve.length - 1]?.dt).toBeCloseTo(62, 6);
    expect(p.finalStrain).toBeGreaterThan(0);
  });
});

describe('mayAutoAdapt', () => {
  const ok = { sessionElapsedSec: 400, sessionRemainingSec: 200, lastAdaptationAtSec: null, completedSegments: 2 };

  it('allows action in the middle of a session', () => {
    expect(mayAutoAdapt(ok)).toBe(true);
  });

  it('waits for at least one full segment', () => {
    expect(mayAutoAdapt({ ...ok, completedSegments: 0 })).toBe(false);
  });

  it('holds off in the final seconds', () => {
    expect(mayAutoAdapt({ ...ok, sessionRemainingSec: FINAL_QUIET_SEC })).toBe(false);
  });

  it('never flaps inside the cooldown', () => {
    expect(mayAutoAdapt({ ...ok, lastAdaptationAtSec: 400 - COOLDOWN_SEC + 1 })).toBe(false);
    expect(mayAutoAdapt({ ...ok, lastAdaptationAtSec: 400 - COOLDOWN_SEC })).toBe(true);
  });
});

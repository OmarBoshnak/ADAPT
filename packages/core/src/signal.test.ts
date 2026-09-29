import { describe, expect, it } from 'vitest';

import {
  BASELINE_SEC,
  Biquad,
  dominantPeriod,
  FloorDetector,
  impactFeatures,
  QualityEstimator,
  rms,
  SAMPLE_RATE,
} from './signal.js';
import { synthesizeTrace, type SynthOptions } from './synth.js';
import type { QualityFrame, SignalProfile } from './types.js';

/** Run a trace through a fresh estimator, returning every half-second frame. */
function score(profile: SignalProfile, opts: Partial<SynthOptions> & { durationSec: number; cadencePerMin: number }) {
  const est = new QualityEstimator({ profile, expectedCadence: opts.cadencePerMin });
  const frames: QualityFrame[] = [];
  const trace = synthesizeTrace({ profile, seed: 3, ...opts });
  trace.forEach((s, i) => {
    est.push(s);
    if ((i + 1) % (SAMPLE_RATE / 2) === 0) frames.push(est.frame());
  });
  return frames;
}

const after = (frames: QualityFrame[], t: number) => frames.filter((f) => f.t >= t);
const avgQ = (frames: QualityFrame[]) => frames.reduce((a, f) => a + f.quality, 0) / Math.max(1, frames.length);

describe('filters', () => {
  it('high-pass removes the constant pull of gravity', () => {
    const hp = new Biquad('highpass', 1, SAMPLE_RATE);
    let y = 0;
    for (let i = 0; i < 500; i++) y = hp.process(1);
    expect(Math.abs(y)).toBeLessThan(1e-3);
  });

  it('low-pass passes a constant through', () => {
    const lp = new Biquad('lowpass', 8, SAMPLE_RATE);
    let y = 0;
    for (let i = 0; i < 500; i++) y = lp.process(1);
    expect(y).toBeCloseTo(1, 3);
  });
});

describe('features', () => {
  it('recovers the period of a steady rhythm', () => {
    const xs = Array.from({ length: 200 }, (_, i) => Math.sin((2 * Math.PI * i) / 25)); // 0.5 s period
    const p = dominantPeriod(xs, SAMPLE_RATE);
    expect(p?.periodSec).toBeCloseTo(0.5, 1);
    expect(p?.periodicity as number).toBeGreaterThan(0.8);
  });

  it('has no period in silence', () => {
    expect(dominantPeriod(new Array(200).fill(0), SAMPLE_RATE)).toBeNull();
  });

  it('computes rms and impact features', () => {
    expect(rms([3, -3, 3, -3])).toBe(3);
    expect(rms([])).toBe(0);
    const f = impactFeatures([
      { t: 0, amplitude: 1 },
      { t: 1, amplitude: 1 },
      { t: 2, amplitude: 1 },
    ]);
    expect(f.intervalSec).toBe(1);
    expect(f.intervalCv).toBe(0);
    expect(impactFeatures([]).intervalSec).toBeNull();
  });
});

describe('QualityEstimator — impact', () => {
  it('reports zero confidence while it captures the baseline', () => {
    const frames = score('impact', { durationSec: BASELINE_SEC - 1, cadencePerMin: 70 });
    expect(frames.every((f) => f.confidence === 0)).toBe(true);
  });

  it('scores steady jumping close to 1, relative to the person’s own first reps', () => {
    const frames = after(score('impact', { durationSec: 40, cadencePerMin: 70 }), BASELINE_SEC + 4);
    expect(frames.every((f) => f.confidence === 1)).toBe(true);
    expect(avgQ(frames)).toBeGreaterThan(0.85);
  });

  it('reads cadence back from the landings', () => {
    const last = score('impact', { durationSec: 30, cadencePerMin: 70 }).at(-1) as QualityFrame;
    expect(last.cadence as number).toBeGreaterThan(60);
    expect(last.cadence as number).toBeLessThan(80);
  });

  it('drops as landings weaken and rhythm frays', () => {
    const fading = score('impact', {
      durationSec: 70,
      cadencePerMin: 70,
      fade: (t) => Math.max(0.3, 1 - Math.max(0, t - 12) / 60),
      jitter: (t) => (t > 12 ? 0.04 + (t - 12) / 300 : 0.04),
    });
    const early = avgQ(fading.filter((f) => f.t > 10 && f.t < 16));
    const late = avgQ(fading.filter((f) => f.t > 60));
    expect(late).toBeLessThan(early - 0.25);
  });

  it('falls toward zero when the person stops', () => {
    const stopped = score('impact', { durationSec: 30, cadencePerMin: 70, fade: (t) => (t > 16 ? 0 : 1) });
    expect(avgQ(after(stopped, 24))).toBeLessThan(0.3);
  });

  it('ignores the signal while the phone is being handled', () => {
    const frames = score('impact', { durationSec: 30, cadencePerMin: 70, pickupsAt: [18] });
    const during = frames.filter((f) => f.t > 18.8 && f.t < 20);
    expect(during.length).toBeGreaterThan(0);
    expect(during.every((f) => f.confidence === 0)).toBe(true);
  });

  it('distrusts a floor that damps almost everything (thick carpet)', () => {
    const frames = after(score('impact', { durationSec: 30, cadencePerMin: 70, amplitudeG: 0.012 }), BASELINE_SEC + 2);
    expect(frames.every((f) => f.confidence < 0.5)).toBe(true);
  });
});

describe('QualityEstimator — other profiles', () => {
  it('scores steady stepping close to 1 (oscillation)', () => {
    const frames = after(score('oscillation', { durationSec: 40, cadencePerMin: 90 }), BASELINE_SEC + 4);
    expect(frames.every((f) => f.confidence === 1)).toBe(true);
    expect(avgQ(frames)).toBeGreaterThan(0.8);
    expect(frames.at(-1)?.cadence).not.toBeNull();
  });

  it('drops when stepping slows and softens (oscillation)', () => {
    const frames = score('oscillation', {
      durationSec: 60,
      cadencePerMin: 90,
      fade: (t) => (t > 14 ? 0.35 : 1),
      pace: (t) => (t > 14 ? 0.6 : 1),
    });
    expect(avgQ(after(frames, 45))).toBeLessThan(0.7);
  });

  it('reports squats and punches with reduced confidence (sustained)', () => {
    const frames = after(score('sustained', { durationSec: 30, cadencePerMin: 22, amplitudeG: 0.05 }), BASELINE_SEC + 2);
    expect(frames.every((f) => f.confidence > 0 && f.confidence < 1)).toBe(true);
  });

  it('never claims to perceive a hold (static)', () => {
    const frames = score('static', { durationSec: 30, cadencePerMin: 0 });
    expect(frames.every((f) => f.confidence === 0 && f.quality === 1)).toBe(true);
  });

  it('re-baselines when the exercise changes', () => {
    const est = new QualityEstimator({ profile: 'impact', expectedCadence: 70 });
    for (const s of synthesizeTrace({ profile: 'impact', durationSec: 20, cadencePerMin: 70 })) est.push(s);
    expect(est.frame().confidence).toBe(1);
    est.reset('oscillation', 90);
    for (const s of synthesizeTrace({ profile: 'oscillation', durationSec: 2, cadencePerMin: 90, startT: 20 })) est.push(s);
    expect(est.frame().confidence).toBe(0);
    expect(est.frame().profile).toBe('oscillation');
  });
});

describe('FloorDetector', () => {
  const still = (t: number, az = 1) => ({ t, ax: 0, ay: 0, az, gx: 0, gy: 0, gz: 0 });
  const run = (d: FloorDetector, from: number, sec: number, sample: (t: number) => Parameters<FloorDetector['push']>[0]) => {
    for (let i = 0; i < sec * SAMPLE_RATE; i++) d.push(sample(from + i / SAMPLE_RATE));
    return d.onFloor;
  };

  it('settles on the floor after a second lying flat and still, face up or down', () => {
    expect(run(new FloorDetector(), 0, 0.5, still)).toBe(false);
    expect(run(new FloorDetector(), 0, 2, still)).toBe(true);
    expect(run(new FloorDetector(), 0, 2, (t) => still(t, -1))).toBe(true);
  });

  it('stays on the floor through the vibration of someone jumping beside it', () => {
    const d = new FloorDetector();
    run(d, 0, 2, still);
    const jumps = synthesizeTrace({ profile: 'impact', durationSec: 20, cadencePerMin: 70, startT: 2, amplitudeG: 0.6 });
    jumps.forEach((s) => d.push(s));
    expect(d.onFloor).toBe(true);
  });

  it('notices within a moment when it is picked up', () => {
    const d = new FloorDetector();
    run(d, 0, 2, still);
    const handled = (t: number) => ({ t, ax: 0.6, ay: 0.2, az: 0.75, gx: 1.2, gy: 0.4, gz: 0.3 });
    expect(run(d, 2, 1, handled)).toBe(false);
  });

  it('does not count a phone propped at an angle', () => {
    expect(run(new FloorDetector(), 0, 3, (t) => ({ ...still(t), ax: 0.5, az: 0.85 }))).toBe(false);
  });
});

/**
 * Movement quality from floor vibration.
 *
 * The phone lies face-up on the floor beside the user. It does not move with them; it
 * feels the floor. That physical fact decides what can and cannot be measured, and this
 * module is honest about it:
 *
 *   impact       jumps and jacks land hard and leave sharp, discrete peaks. Measured well:
 *                peak strength against the person's own first reps, and rhythm steadiness.
 *   oscillation  stepping and marching leave softer periodic footfalls. Measured by energy,
 *                cadence, and how periodic the signal still is.
 *   sustained    squats, lunges and punches barely change floor contact. Measured weakly,
 *                and reported with reduced confidence.
 *   static       holds put nothing into the floor at all. Not measured — confidence is always
 *                zero, and the strain model runs on prediction alone.
 *
 * Every score is relative to a baseline captured from the first seconds of each exercise
 * (the reason TV-6 insists the person is in position before the first rep). There is no
 * universal "good form" number, and nothing here ever produces one.
 *
 * Pipeline, per sample at 50 Hz:
 *   |a| → high-pass 1 Hz (removes gravity) → low-pass 8 Hz (removes electrical noise)
 * and separately, per axis:
 *   a → low-pass 0.3 Hz → gravity direction → "has the phone been picked up?"
 */

import type { QualityFrame, SensorSample, SignalProfile } from './types.js';

export const SAMPLE_RATE = 50;
export const BASELINE_SEC = 8;
const WINDOW_SEC = 4;
const PEAK_REFRACTORY_SEC = 0.25;
const PEAK_SIGMA = 1.5;
const PEAK_NOISE_FLOOR_G = 0.02;
const PICKUP_ANGLE_DEG = 25;
const PICKUP_HOLDOFF_SEC = 2;
/** Baselines weaker than these mean the floor is damping almost everything (thick carpet). */
const WEAK_IMPACT_G = 0.03;
const WEAK_RMS_G = 0.008;
const WEAK_CONFIDENCE = 0.2;
const SUSTAINED_CONFIDENCE = 0.6;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** RBJ-cookbook biquad. Pure arithmetic — no platform DSP required. */
export class Biquad {
  private b0: number;
  private b1: number;
  private b2: number;
  private a1: number;
  private a2: number;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(type: 'lowpass' | 'highpass', cutoffHz: number, sampleRate: number, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    if (type === 'lowpass') {
      this.b0 = (1 - cos) / 2 / a0;
      this.b1 = (1 - cos) / a0;
      this.b2 = (1 - cos) / 2 / a0;
    } else {
      this.b0 = (1 + cos) / 2 / a0;
      this.b1 = -(1 + cos) / a0;
      this.b2 = (1 + cos) / 2 / a0;
    }
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// ---------------------------------------------------------------------------
// Feature extraction (pure)
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export function rms(xs: number[]): number {
  return xs.length ? Math.sqrt(mean(xs.map((x) => x * x))) : 0;
}

/**
 * Dominant period by normalised autocorrelation, searched between 0.25 s and 2 s — the
 * range of human stepping and bouncing. Returns the period and how periodic the signal is
 * (1 = perfectly periodic, 0 = noise).
 */
export function dominantPeriod(xs: number[], sampleRate: number): { periodSec: number; periodicity: number } | null {
  const energy = xs.reduce((a, x) => a + x * x, 0);
  if (energy <= 1e-12) return null;
  const minLag = Math.round(0.25 * sampleRate);
  const maxLag = Math.min(Math.round(2 * sampleRate), xs.length - 1);
  let bestLag = -1;
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i + lag < xs.length; i++) acc += (xs[i] as number) * (xs[i + lag] as number);
    // Unbiased: normalise by overlap length so long lags are not penalised.
    const r = acc / energy / ((xs.length - lag) / xs.length);
    if (r > best) {
      best = r;
      bestLag = lag;
    }
  }
  if (bestLag < 0) return null;
  return { periodSec: bestLag / sampleRate, periodicity: clamp01(best) };
}

export interface Peak {
  t: number;
  amplitude: number;
}

export interface ImpactFeatures {
  amplitude: number;
  intervalSec: number | null;
  intervalCv: number | null;
  count: number;
}

export function impactFeatures(peaks: Peak[]): ImpactFeatures {
  const amps = peaks.map((p) => p.amplitude);
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) intervals.push((peaks[i] as Peak).t - (peaks[i - 1] as Peak).t);
  const mi = intervals.length ? mean(intervals) : null;
  return {
    amplitude: mean(amps),
    intervalSec: mi,
    intervalCv: mi && intervals.length >= 2 ? std(intervals) / mi : null,
    count: peaks.length,
  };
}

// ---------------------------------------------------------------------------
// The estimator
// ---------------------------------------------------------------------------

interface Baseline {
  amplitude: number;
  intervalSec: number;
  intervalCv: number;
  rms: number;
  frequency: number;
  periodicity: number;
}

export interface EstimatorOptions {
  profile: SignalProfile;
  expectedCadence?: number | null;
  sampleRate?: number;
  baselineSec?: number;
}

/**
 * Stateful, streaming quality estimator. One per exercise: call `reset` when the exercise
 * changes, because a new movement has a new signal shape and needs a new baseline.
 */
export class QualityEstimator {
  private profile: SignalProfile = 'impact';
  private expectedCadence: number | null = null;
  private readonly sampleRate: number;
  private readonly baselineSec: number;

  private hp!: Biquad;
  private lp!: Biquad;
  private grav!: [Biquad, Biquad, Biquad];

  private startT: number | null = null;
  private lastT = 0;
  private band: number[] = [];
  private times: number[] = [];
  private peaks: Peak[] = [];
  private lastPeakT = -Infinity;
  private baseline: Baseline | null = null;
  private refGravity: [number, number, number] | null = null;
  private handledUntil = -Infinity;
  private sampleCount = 0;

  constructor(opts: EstimatorOptions) {
    this.sampleRate = opts.sampleRate ?? SAMPLE_RATE;
    this.baselineSec = opts.baselineSec ?? BASELINE_SEC;
    this.reset(opts.profile, opts.expectedCadence ?? null);
  }

  reset(profile: SignalProfile, expectedCadence: number | null = null): void {
    this.profile = profile;
    this.expectedCadence = expectedCadence;
    this.hp = new Biquad('highpass', 1, this.sampleRate);
    this.lp = new Biquad('lowpass', 8, this.sampleRate);
    this.grav = [
      new Biquad('lowpass', 0.3, this.sampleRate),
      new Biquad('lowpass', 0.3, this.sampleRate),
      new Biquad('lowpass', 0.3, this.sampleRate),
    ];
    this.startT = null;
    this.band = [];
    this.times = [];
    this.peaks = [];
    this.lastPeakT = -Infinity;
    this.baseline = null;
    this.sampleCount = 0;
    // refGravity survives a reset: the phone has not moved just because the exercise did.
  }

  push(s: SensorSample): void {
    if (this.startT === null) this.startT = s.t;
    this.lastT = s.t;
    this.sampleCount++;

    // Gravity direction — a slow low-pass on each axis.
    const g: [number, number, number] = [
      this.grav[0].process(s.ax),
      this.grav[1].process(s.ay),
      this.grav[2].process(s.az),
    ];
    if (this.refGravity === null && this.sampleCount >= this.sampleRate) this.refGravity = g;
    if (this.refGravity && angleDeg(g, this.refGravity) > PICKUP_ANGLE_DEG) {
      this.handledUntil = s.t + PICKUP_HOLDOFF_SEC;
    }

    // Floor-vibration band.
    const mag = Math.sqrt(s.ax * s.ax + s.ay * s.ay + s.az * s.az);
    const x = this.lp.process(this.hp.process(mag));
    this.band.push(x);
    this.times.push(s.t);
    const keep = Math.round(WINDOW_SEC * this.sampleRate);
    if (this.band.length > keep) {
      this.band.splice(0, this.band.length - keep);
      this.times.splice(0, this.times.length - keep);
    }

    this.detectPeak();

    if (!this.baseline && s.t - this.startT >= this.baselineSec) this.baseline = this.captureBaseline();
  }

  /** Online peak detection on the previous sample, against an adaptive threshold. */
  private detectPeak(): void {
    const n = this.band.length;
    if (n < 3) return;
    const prev = this.band[n - 2] as number;
    if (!(prev > (this.band[n - 3] as number) && prev >= (this.band[n - 1] as number))) return;
    const t = this.times[n - 2] as number;
    if (t - this.lastPeakT < PEAK_REFRACTORY_SEC) return;
    const threshold = Math.max(PEAK_NOISE_FLOOR_G, mean(this.band) + PEAK_SIGMA * std(this.band));
    if (prev < threshold) return;
    this.peaks.push({ t, amplitude: prev });
    this.lastPeakT = t;
    if (this.peaks.length > 40) this.peaks.shift();
  }

  private windowPeaks(now: number): Peak[] {
    return this.peaks.filter((p) => p.t > now - WINDOW_SEC);
  }

  private captureBaseline(): Baseline {
    const f = impactFeatures(this.windowPeaks(this.lastT));
    const period = dominantPeriod(this.band, this.sampleRate);
    const fallbackInterval = this.expectedCadence ? 60 / this.expectedCadence : 1;
    return {
      amplitude: f.amplitude,
      intervalSec: f.intervalSec ?? fallbackInterval,
      intervalCv: f.intervalCv ?? 0.1,
      rms: rms(this.band),
      frequency: period ? 1 / period.periodSec : 1 / fallbackInterval,
      periodicity: period?.periodicity ?? 0.5,
    };
  }

  frame(): QualityFrame {
    const t = this.lastT;
    const base: QualityFrame = { t, quality: 1, cadence: null, confidence: 0, profile: this.profile };

    if (this.profile === 'static') return base;
    if (!this.baseline) return base;
    if (t < this.handledUntil) return base;

    const b = this.baseline;

    if (this.profile === 'impact') {
      const f = impactFeatures(this.windowPeaks(t));
      const expected = WINDOW_SEC / Math.max(b.intervalSec, 0.2);
      const coverage = clamp01(f.count / Math.max(1, expected * 0.9));
      const strength = b.amplitude > 0 ? clamp01(f.amplitude / b.amplitude) : 0;
      const cv = f.intervalCv ?? b.intervalCv;
      const rhythm = clamp01(1 - Math.max(0, cv - b.intervalCv) / 0.3);
      return {
        ...base,
        quality: coverage * (0.6 * strength + 0.4 * rhythm),
        cadence: f.intervalSec ? 60 / f.intervalSec : null,
        confidence: b.amplitude < WEAK_IMPACT_G ? WEAK_CONFIDENCE : 1,
      };
    }

    const energy = b.rms > 0 ? clamp01(rms(this.band) / b.rms) : 0;

    if (this.profile === 'oscillation') {
      const p = dominantPeriod(this.band, this.sampleRate);
      const freq = p ? clamp01(1 / p.periodSec / b.frequency) : 0;
      const periodic = p && b.periodicity > 0 ? clamp01(p.periodicity / b.periodicity) : 0;
      return {
        ...base,
        quality: 0.5 * energy + 0.3 * freq + 0.2 * periodic,
        cadence: p ? 60 / p.periodSec : null,
        confidence: b.rms < WEAK_RMS_G ? WEAK_CONFIDENCE : 1,
      };
    }

    // sustained
    return {
      ...base,
      quality: energy,
      cadence: null,
      confidence: b.rms < WEAK_RMS_G ? WEAK_CONFIDENCE : SUSTAINED_CONFIDENCE,
    };
  }
}

function angleDeg(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const na = Math.hypot(...a);
  const nb = Math.hypot(...b);
  if (na === 0 || nb === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / (na * nb)))) * 180) / Math.PI;
}

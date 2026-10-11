import {
  BASELINE_SEC,
  CONFIDENCE_FLOOR,
  FloorDetector,
  measuredRate,
  QualityEstimator,
  SAMPLE_RATE,
  unpackTrace,
  type QualityFrame,
  type Trace,
} from '@adapt/core';

export interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

export interface Report {
  trace: Trace;
  seconds: number;
  rate: number | null;
  frames: QualityFrame[];
  early: number | null;
  late: number | null;
  trusted: number;
  cadence: number | null;
  checks: Check[];
}

const RATE_TOLERANCE = 0.1;
const STEADY_MIN = 0.75;
const FADE_DROP = 0.2;
const TRUSTED_MIN = 0.8;
const EARLY_WINDOW_SEC = 15;
const LATE_FRACTION = 0.2;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] as number;
};
const fmt = (n: number | null, digits = 2) => (n === null ? '—' : n.toFixed(digits));

export function analyze(trace: Trace): Report {
  const samples = unpackTrace(trace);
  const start = samples[0]?.t ?? 0;
  const estimator = new QualityEstimator({ profile: trace.profile, expectedCadence: trace.expectedCadence });
  const floor = new FloorDetector();
  const frames: QualityFrame[] = [];
  let wasOnFloor = false;
  let leftFloor = false;

  samples.forEach((s, i) => {
    estimator.push(s);
    const onFloor = floor.push(s);
    if (wasOnFloor && !onFloor) leftFloor = true;
    wasOnFloor ||= onFloor;
    if ((i + 1) % (SAMPLE_RATE / 2) === 0) frames.push({ ...estimator.frame(), t: s.t - start });
  });

  const seconds = (samples[samples.length - 1]?.t ?? start) - start;
  const measured = frames.filter((f) => f.t >= BASELINE_SEC);
  const trusted = measured.filter((f) => f.confidence >= CONFIDENCE_FLOOR);
  const quality = (from: number, to: number) => mean(trusted.filter((f) => f.t >= from && f.t < to).map((f) => f.quality));
  const early = quality(BASELINE_SEC, BASELINE_SEC + EARLY_WINDOW_SEC);
  const late = quality(seconds * (1 - LATE_FRACTION), Infinity);
  const trustedShare = measured.length ? trusted.length / measured.length : 0;
  const rate = measuredRate(samples);
  const cadence = median(trusted.flatMap((f) => (f.cadence === null ? [] : [f.cadence])));

  const checks: Check[] = [
    {
      name: 'sample rate',
      pass: rate !== null && Math.abs(rate - SAMPLE_RATE) <= SAMPLE_RATE * RATE_TOLERANCE,
      detail: `${fmt(rate, 1)} Hz, estimators assume ${SAMPLE_RATE}`,
    },
  ];

  if (trace.profile === 'static') {
    checks.push({
      name: 'never claims to read a hold',
      pass: measured.every((f) => f.confidence === 0),
      detail: `${measured.filter((f) => f.confidence > 0).length} frames with confidence`,
    });
    return { trace, seconds, rate, frames, early, late, trusted: trustedShare, cadence, checks };
  }

  const readable = trace.floor === 'hard' && trace.profile !== 'sustained';

  if (trace.take === 'steady') {
    if (readable) {
      checks.push({ name: 'reads the movement', pass: trustedShare >= TRUSTED_MIN, detail: `${fmt(trustedShare * 100, 0)}% of frames trusted` });
    }
    checks.push({
      name: 'steady scores high throughout',
      pass: trusted.length === 0 || ((early ?? 0) >= STEADY_MIN && (late ?? 0) >= STEADY_MIN),
      detail: `early ${fmt(early)} · late ${fmt(late)} · floor ${STEADY_MIN}`,
    });
  }

  if (trace.take === 'fading' && readable) {
    checks.push({
      name: 'notices the fade',
      pass: early !== null && late !== null && early - late >= FADE_DROP,
      detail: `early ${fmt(early)} → late ${fmt(late)} · needs a drop of ${FADE_DROP}`,
    });
  }

  if (trace.take === 'pickup') {
    checks.push({
      name: 'stops trusting a handled phone',
      pass: leftFloor && measured.some((f) => f.confidence === 0),
      detail: leftFloor ? 'left the floor and confidence went to 0' : 'never noticed leaving the floor',
    });
  }

  if (trace.profile === 'sustained') {
    checks.push({
      name: 'reports reduced confidence',
      pass: measured.every((f) => f.confidence < 1),
      detail: `max confidence ${fmt(Math.max(0, ...measured.map((f) => f.confidence)))}`,
    });
  }

  return { trace, seconds, rate, frames, early, late, trusted: trustedShare, cadence, checks };
}

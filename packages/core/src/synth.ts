/**
 * Synthetic floor-vibration traces.
 *
 * Used by the tests and by `tools/sim` so the whole pipeline — raw samples → estimator →
 * strain → adaptation — can run headlessly, deterministically, and in milliseconds.
 *
 * These are shaped by the same physics `signal.ts` assumes: a landing is a short damped
 * ring in the 1–8 Hz band, a footfall is a softer and slower one, a hold is noise. They are
 * NOT a substitute for real recordings. Phase 5 records real traces from a real floor and
 * re-tunes against those, because synthetic data will have flattered the estimator
 * somewhere.
 */

import { createRng, gaussian } from './random.js';
import type { SensorSample, SignalProfile } from './types.js';
import { SAMPLE_RATE } from './signal.js';

export interface SynthOptions {
  profile: SignalProfile;
  durationSec: number;
  /** Events per minute: landings for impact, footfalls for oscillation. */
  cadencePerMin: number;
  /** Peak floor response, in g. */
  amplitudeG?: number;
  /** Multiplies amplitude over the segment; receives seconds since start. 1 = fresh. */
  fade?: (tSec: number) => number;
  /** Timing irregularity (coefficient of variation of the interval) over the segment. */
  jitter?: (tSec: number) => number;
  /** Multiplies cadence over the segment. Below 1 = slowing down. */
  pace?: (tSec: number) => number;
  noiseG?: number;
  startT?: number;
  seed?: number;
  sampleRate?: number;
  /** Seconds (relative to start) at which the phone is picked up for one second. */
  pickupsAt?: number[];
}

const DEFAULT_AMPLITUDE: Record<SignalProfile, number> = {
  impact: 0.35,
  oscillation: 0.12,
  sustained: 0.04,
  static: 0,
};

/** Ring frequency and decay per profile — a landing rings harder and faster than a step. */
const RESPONSE: Record<SignalProfile, { hz: number; decaySec: number }> = {
  impact: { hz: 6, decaySec: 0.08 },
  oscillation: { hz: 3.5, decaySec: 0.12 },
  sustained: { hz: 2.5, decaySec: 0.18 },
  static: { hz: 0, decaySec: 1 },
};

export function synthesizeTrace(opts: SynthOptions): SensorSample[] {
  const fs = opts.sampleRate ?? SAMPLE_RATE;
  const rng = createRng(opts.seed ?? 1);
  const amp = opts.amplitudeG ?? DEFAULT_AMPLITUDE[opts.profile];
  const noise = opts.noiseG ?? 0.004;
  const start = opts.startT ?? 0;
  const { hz, decaySec } = RESPONSE[opts.profile];
  const n = Math.round(opts.durationSec * fs);

  // Schedule events first, so irregular timing is honest rather than resampled.
  const events: Array<{ t: number; a: number }> = [];
  if (opts.profile !== 'static' && opts.cadencePerMin > 0) {
    let t = 0.3;
    while (t < opts.durationSec) {
      const f = opts.fade?.(t) ?? 1;
      events.push({ t, a: amp * f * (1 + 0.08 * gaussian(rng)) });
      const pace = opts.pace?.(t) ?? 1;
      const interval = 60 / (opts.cadencePerMin * pace);
      const cv = opts.jitter?.(t) ?? 0.04;
      t += Math.max(0.12, interval * (1 + cv * gaussian(rng)));
    }
  }

  const samples: SensorSample[] = [];
  let e = 0;
  for (let i = 0; i < n; i++) {
    const tRel = i / fs;
    while (e < events.length && (events[e] as { t: number }).t < tRel - 6 * decaySec) e++;

    let v = 0;
    for (let k = e; k < events.length; k++) {
      const ev = events[k] as { t: number; a: number };
      if (ev.t > tRel) break;
      const dt = tRel - ev.t;
      v += ev.a * Math.exp(-dt / decaySec) * Math.sin(2 * Math.PI * hz * dt);
    }

    // Face-up on the floor: gravity on z. A pick-up tilts it and adds handling motion.
    let gx = 0;
    let gz = 1;
    let handling = 0;
    for (const p of opts.pickupsAt ?? []) {
      if (tRel >= p && tRel < p + 1) {
        gx = 0.7;
        gz = 0.7;
        handling = 0.3 * Math.sin(2 * Math.PI * 2 * tRel);
      }
    }

    samples.push({
      t: start + tRel,
      ax: gx + handling + noise * gaussian(rng),
      ay: noise * gaussian(rng),
      az: gz + v + noise * gaussian(rng),
      gx: 0.01 * gaussian(rng),
      gy: 0.01 * gaussian(rng),
      gz: 0.01 * gaussian(rng),
    });
  }
  return samples;
}

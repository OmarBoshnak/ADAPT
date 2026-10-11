// A recorded stretch of real floor vibration, labelled with what the person was asked to do.

import { z } from 'zod';

import { SignalProfileSchema } from './protocol.js';
import type { SensorSample } from './types.js';

export const TAKES = ['steady', 'fading', 'pickup'] as const;
export type Take = (typeof TAKES)[number];

export const TAKE_SECONDS: Record<Take, number> = { steady: 45, fading: 75, pickup: 30 };

const MAX_SECONDS = 180;

const number = z.number().finite();
const SampleTuple = z.tuple([number, number, number, number, number, number, number]);

export const TraceSchema = z.object({
  v: z.literal(1),
  exerciseId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  name: z.string().max(80),
  profile: SignalProfileSchema,
  expectedCadence: z.number().positive().nullable(),
  take: z.enum(TAKES),
  floor: z.enum(['hard', 'soft']),
  device: z.string().max(80),
  recordedAt: z.string().datetime(),
  samples: z.array(SampleTuple).min(1).max(MAX_SECONDS * 100),
});

export type Trace = z.infer<typeof TraceSchema>;
export type TraceMeta = Omit<Trace, 'v' | 'samples'>;

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function packTrace(meta: TraceMeta, samples: SensorSample[]): Trace {
  return {
    v: 1,
    ...meta,
    samples: samples.map((s) => [round(s.t), round(s.ax), round(s.ay), round(s.az), round(s.gx), round(s.gy), round(s.gz)]),
  };
}

export function unpackTrace(trace: Trace): SensorSample[] {
  return trace.samples.map(([t, ax, ay, az, gx, gy, gz]) => ({ t, ax, ay, az, gx, gy, gz }));
}

/** Samples per second actually delivered, which the estimators assume is SAMPLE_RATE. */
export function measuredRate(samples: SensorSample[]): number | null {
  if (samples.length < 2) return null;
  const span = (samples[samples.length - 1] as SensorSample).t - (samples[0] as SensorSample).t;
  return span > 0 ? (samples.length - 1) / span : null;
}

export function traceFileName(trace: Trace): string {
  return `${trace.exerciseId}.${trace.take}.${trace.recordedAt.replace(/[:.]/g, '-')}.json`;
}

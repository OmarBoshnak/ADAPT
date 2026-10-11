import { describe, expect, it } from 'vitest';
import { packTrace, synthesizeTrace, type SignalProfile, type SynthOptions, type Take } from '@adapt/core';

import { analyze } from './analyze.js';
import { loadTraces } from '@adapt/data/fixtures';

function trace(take: Take, profile: SignalProfile, synth: Partial<SynthOptions> = {}, floor: 'hard' | 'soft' = 'hard') {
  const samples = synthesizeTrace({ profile, durationSec: 45, cadencePerMin: 70, seed: 7, ...synth });
  return packTrace(
    { exerciseId: 'test', name: 'Test', profile, expectedCadence: 70, take, floor, device: 'synthetic', recordedAt: '2026-09-29T12:00:00.000Z' },
    samples,
  );
}

const failures = (t: ReturnType<typeof trace>) => analyze(t).checks.filter((c) => !c.pass).map((c) => c.name);

describe('analyze', () => {
  it('passes a steady take', () => {
    expect(failures(trace('steady', 'impact'))).toEqual([]);
  });

  it('passes a fade the estimator notices, and fails one it cannot tell from steady', () => {
    const fade = (t: number) => Math.max(0.3, 1 - Math.max(0, t - 20) / 30);
    expect(failures(trace('fading', 'impact', { durationSec: 75, fade, jitter: (t) => 0.04 + 0.2 * (1 - fade(t)) }))).toEqual([]);
    expect(failures(trace('fading', 'impact', { durationSec: 75 }))).toContain('notices the fade');
  });

  it('passes a pickup only when the phone left the floor', () => {
    expect(failures(trace('pickup', 'impact', { durationSec: 30, pickupsAt: [18] }))).toEqual([]);
    expect(failures(trace('pickup', 'impact', { durationSec: 30 }))).toContain('stops trusting a handled phone');
  });

  it('holds a hold to confidence zero', () => {
    expect(failures(trace('steady', 'static'))).toEqual([]);
  });

  it('flags a sample rate the estimators were not built for', () => {
    expect(failures(trace('steady', 'impact', { sampleRate: 30 }))).toContain('sample rate');
  });
});

const recorded = loadTraces();

describe.skipIf(recorded.length === 0)('recorded traces', () => {
  it.each(recorded)('$file', ({ trace: t }) => {
    expect(analyze(t).checks.filter((c) => !c.pass)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import { acceptCoachPlan, acceptNarrative, narrativeRequest, planRequest } from './coach.js';
import { isSafeCopy } from './copy-rules.js';
import { generatePlan, type GenerateInput } from './generator.js';
import { fixtureGraph, fixtureProfile } from './graph.fixture.js';
import { createSession, reduce, type SessionContext } from './session.js';
import type { Profile } from './types.js';

const graph = fixtureGraph();
const input = (p: Partial<Profile> = {}, durationMin = 12, energy: GenerateInput['energy'] = 'medium'): GenerateInput => ({
  graph,
  profile: fixtureProfile(p),
  durationMin,
  energy,
  seed: 5,
});
const alternate = (a: string, b: string, n: number) => Array.from({ length: n }, (_, k) => (k % 2 ? b : a));

const reference = (i: GenerateInput) => generatePlan(i).segments.map((s) => s.exerciseId);
const reply = (exerciseIds: string[], title = 'Morning Reset') => ({ exerciseIds, title, rationale: 'x' });

describe('planRequest', () => {
  it('sends movements, never the profile they were filtered by', () => {
    const request = planRequest(input({ injuries: ['knee'], ageYears: 61, heightCm: 170, weightKg: 90 }));
    const sent = JSON.stringify(request);
    for (const secret of ['knee', '61', '170', '90', 'injur', 'age', 'weight', 'height']) expect(sent).not.toContain(secret);
    expect(Object.keys(request).sort()).toEqual(['candidates', 'count', 'energy', 'minutes', 'targetIntensity', 'task']);
  });

  it('offers only what the profile allows', () => {
    const ids = planRequest(input({ injuries: ['knee'] })).candidates.map((c) => c.id);
    expect(ids).not.toContain('jacks');
    expect(ids).not.toContain('big_jump');
  });

  it('asks for the same number of movements and load as the local generator would build', () => {
    const i = input();
    const request = planRequest(i);
    expect(request.count).toBe(generatePlan(i).segments.length);
    expect(request.targetIntensity.max - request.targetIntensity.min).toBeCloseTo(1.2, 5);
  });
});

describe('acceptCoachPlan', () => {
  it('accepts a valid choice and builds the plan from it', () => {
    const i = input();
    const check = acceptCoachPlan(i, planRequest(i), reply(reference(i)));
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.plan.generatedLocally).toBe(false);
      expect(check.plan.title).toBe('Morning Reset');
      expect(check.plan.segments.map((s) => s.exerciseId)).toEqual(reference(i));
    }
  });

  it('rejects a movement it was never offered, however plausible', () => {
    const i = input({ injuries: ['knee'] });
    const ids = reference(i);
    ids[1] = 'jacks';
    const check = acceptCoachPlan(i, planRequest(i), reply(ids));
    expect(check.ok).toBe(false);
    expect(!check.ok && check.reasons).toContainEqual(expect.stringContaining('not offered: jacks'));
  });

  it('rejects the wrong length and back-to-back repeats', () => {
    const i = input();
    const ids = reference(i);
    expect(acceptCoachPlan(i, planRequest(i), reply(ids.slice(1))).ok).toBe(false);
    const repeated = [ids[0] as string, ids[0] as string, ...ids.slice(2)];
    expect(acceptCoachPlan(i, planRequest(i), reply(repeated)).ok).toBe(false);
  });

  it('rejects a plan the strain model says is too easy or too hard for the session asked for', () => {
    const easy = input({}, 8);
    expect(acceptCoachPlan(easy, planRequest(easy), reply(alternate('fast_march', 'jacks', 5)))).toEqual({
      ok: false,
      reasons: ['never reaches the threshold: easier than this session should be'],
    });
    const hard = input({}, 20, 'low');
    expect(acceptCoachPlan(hard, planRequest(hard), reply(alternate('big_jump', 'jacks', 8)))).toEqual({
      ok: false,
      reasons: ['reaches the threshold too early: harder than this session allows'],
    });
  });

  it('does not demand an adaptation from a session too short and gentle to reach one', () => {
    const i = input({}, 8, 'high');
    expect(acceptCoachPlan(i, planRequest(i), reply(alternate('fast_march', 'jacks', 5))).ok).toBe(true);
  });

  it('rejects anything off-contract, and keeps the default title over unsafe copy', () => {
    const i = input();
    expect(acceptCoachPlan(i, planRequest(i), { exerciseIds: 'jacks' }).ok).toBe(false);
    const check = acceptCoachPlan(i, planRequest(i), reply(reference(i), 'Burn the calories'));
    expect(check.ok && check.plan.title).toBe('12-Minute Cardio Reset');
  });
});

describe('narrative', () => {
  const ctx: SessionContext = { graph, profile: fixtureProfile(), energy: 'medium' };
  const run = (correct: boolean) => {
    const plan = generatePlan({ graph, profile: ctx.profile, durationMin: 8, energy: 'medium', seed: 5 });
    let s = createSession(ctx, plan);
    s = reduce(ctx, s, { type: 'TICK', dtSec: plan.getReadySec + plan.segments[0]!.durationSec + plan.restSec + 10 });
    if (correct) s = reduce(ctx, s, { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' });
    return narrativeRequest(ctx, s);
  };

  it('is only requested after a real correction', () => {
    expect(run(false)).toBeNull();
    const request = run(true);
    expect(request).toMatchObject({ task: 'narrative', corrections: [{ direction: 'easier' }] });
    expect(request!.biasAfter).toBeLessThan(request!.biasBefore);
  });

  it('shows a safe line and falls back on anything else', () => {
    expect(acceptNarrative({ line: 'You asked sooner than I planned, so next time I’ll step in earlier.' })).toMatch(/step in/);
    expect(acceptNarrative({ line: 'Your form failed on the jumps.' })).toBeNull();
    expect(acceptNarrative({ line: '' })).toBeNull();
    expect(acceptNarrative('nope')).toBeNull();
  });
});

describe('isSafeCopy', () => {
  it('blocks body, clinical, alarm and camera language, and markup', () => {
    for (const bad of [
      'Great for weight loss',
      'Easy on that knee injury',
      'Warning: slow down',
      'I watched you closely',
      'See https://example.com',
      '**Nice**',
    ]) {
      expect(isSafeCopy(bad)).toBe(false);
    }
    expect(isSafeCopy('Next session starts lighter and adapts sooner.')).toBe(true);
  });
});

// The contract with the cloud coach, and the checks its answers must pass before they reach a screen.
// The coach only ever sees movements already judged suitable, never the profile they were filtered by.

import { z } from 'zod';

import { assemblePlan, generatePlan, planShape, projectedCrossing, type GenerateInput } from './generator.js';
import { getExercise } from './graph.js';
import { SignalProfileSchema } from './protocol.js';
import type { SessionContext, SessionState } from './session.js';
import { isSafeCopy } from './copy-rules.js';
import type { SessionPlan } from './types.js';

const INTENSITY_TOLERANCE = 0.6;
const CROSSING_WINDOW = [0.4, 0.9] as const;
const MIN_CANDIDATES = 4;

const Id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);

export const CoachCandidateSchema = z.object({
  id: Id,
  name: z.string().max(80),
  intensity: z.number().min(0).max(10),
  family: z.string().max(40),
  signal: SignalProfileSchema,
});

export const CoachPlanRequestSchema = z.object({
  task: z.literal('plan'),
  minutes: z.number().int().positive(),
  energy: z.enum(['low', 'medium', 'high']),
  count: z.number().int().positive(),
  targetIntensity: z.object({ min: z.number(), max: z.number() }),
  candidates: z.array(CoachCandidateSchema).min(1),
});

export const CoachPlanReplySchema = z.object({
  exerciseIds: z.array(Id).min(1).max(12),
  title: z.string().max(60),
  rationale: z.string().max(400),
});

export const CoachNarrativeRequestSchema = z.object({
  task: z.literal('narrative'),
  minutes: z.number().int().positive(),
  adaptations: z.array(
    z.object({
      atSec: z.number().nonnegative(),
      from: z.string().max(80),
      to: z.string().max(80),
      trigger: z.enum(['predicted-strain', 'user-correction']),
    }),
  ),
  corrections: z.array(z.object({ atSec: z.number().nonnegative(), direction: z.enum(['easier', 'harder']) })),
  earlySec: z.number().nonnegative(),
  biasBefore: z.number(),
  biasAfter: z.number(),
});

export const CoachNarrativeReplySchema = z.object({ line: z.string().min(1).max(200) });

export type CoachPlanRequest = z.infer<typeof CoachPlanRequestSchema>;
export type CoachPlanReply = z.infer<typeof CoachPlanReplySchema>;
export type CoachNarrativeRequest = z.infer<typeof CoachNarrativeRequestSchema>;
export type CoachNarrativeReply = z.infer<typeof CoachNarrativeReplySchema>;

export const COACH_SCHEMAS = {
  'plan-request': CoachPlanRequestSchema,
  'plan-reply': CoachPlanReplySchema,
  'narrative-request': CoachNarrativeRequestSchema,
  'narrative-reply': CoachNarrativeReplySchema,
} as const;

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/** What the coach is asked to choose from, sized by the same model as the local generator. */
export function planRequest(input: GenerateInput): CoachPlanRequest {
  const shape = planShape(input);
  const reference = generatePlan(input).segments.map((s) => getExercise(input.graph, s.exerciseId).intensity);
  const target = mean(reference);
  const withinCeiling = shape.candidates.filter((ex) => ex.intensity <= shape.ceiling);
  const pool = withinCeiling.length >= MIN_CANDIDATES ? withinCeiling : shape.candidates;

  return {
    task: 'plan',
    minutes: input.durationMin,
    energy: input.energy,
    count: shape.count,
    targetIntensity: { min: round1(target - INTENSITY_TOLERANCE), max: round1(target + INTENSITY_TOLERANCE) },
    candidates: pool.map((ex) => ({
      id: ex.id,
      name: ex.name,
      intensity: ex.intensity,
      family: ex.family ?? ex.id,
      signal: ex.signalProfile,
    })),
  };
}

export type CoachCheck = { ok: true; plan: SessionPlan } | { ok: false; reasons: string[] };

/** Re-validates the coach's answer against the request it was given and the real strain model. */
export function acceptCoachPlan(input: GenerateInput, request: CoachPlanRequest, reply: unknown): CoachCheck {
  const parsed = CoachPlanReplySchema.safeParse(reply);
  if (!parsed.success) return { ok: false, reasons: ['reply does not match the contract'] };
  const { exerciseIds: ids, title } = parsed.data;
  const offered = new Map(request.candidates.map((c) => [c.id, c]));
  const reasons: string[] = [];

  if (ids.length !== request.count) reasons.push(`expected ${request.count} movements, got ${ids.length}`);
  const unknown = ids.filter((id) => !offered.has(id));
  if (unknown.length) reasons.push(`not offered: ${unknown.join(', ')}`);
  ids.forEach((id, i) => {
    if (i > 0 && ids[i - 1] === id) reasons.push(`${id} twice in a row`);
  });
  if (reasons.length) return { ok: false, reasons };

  // The window is widened to wherever the local plan lands, so the coach is never held to a stricter standard.
  // Short, gentle sessions may not reach the threshold at all; then neither need the coach's.
  const shape = planShape(input);
  const [lo, hi] = CROSSING_WINDOW;
  const local = projectedCrossing(input.graph, shape, generatePlan(input).segments.map((s) => s.exerciseId));
  const earliest = Math.min(lo * shape.totalSec, local ?? Infinity);
  const latest = local === null ? Infinity : Math.max(hi * shape.totalSec, local);
  const crossing = projectedCrossing(input.graph, shape, ids);
  if (crossing !== null && crossing < earliest) {
    return { ok: false, reasons: ['reaches the threshold too early: harder than this session allows'] };
  }
  if (crossing === null ? local !== null : crossing > latest) {
    return { ok: false, reasons: ['never reaches the threshold: easier than this session should be'] };
  }

  const cleanTitle = title.trim();
  return {
    ok: true,
    plan: assemblePlan(input, shape, ids, {
      generatedLocally: false,
      ...(cleanTitle && isSafeCopy(cleanTitle) ? { title: cleanTitle } : {}),
    }),
  };
}

/** Only sent when the person corrected the model; the card it fills appears only then. */
export function narrativeRequest(ctx: SessionContext, s: SessionState): CoachNarrativeRequest | null {
  const learned = [...s.learning].reverse().find((l) => l.direction === 'easier');
  if (!learned) return null;
  return {
    task: 'narrative',
    minutes: Math.round(s.plan.totalDurationSec / 60),
    adaptations: s.adaptations.map((a) => ({
      atSec: Math.round(a.atSec),
      from: getExercise(ctx.graph, a.fromExerciseId).name,
      to: getExercise(ctx.graph, a.toExerciseId).name,
      trigger: a.trigger,
    })),
    corrections: s.corrections.map((c) => ({ atSec: Math.round(c.atSec), direction: c.direction })),
    earlySec: Math.round(learned.earlySec),
    biasBefore: learned.biasBefore,
    biasAfter: learned.biasAfter,
  };
}

/** The narrative line to show, or null to keep the built-in sentence. */
export function acceptNarrative(reply: unknown): string | null {
  const parsed = CoachNarrativeReplySchema.safeParse(reply);
  if (!parsed.success) return null;
  const line = parsed.data.line.trim();
  return line && isSafeCopy(line) ? line : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

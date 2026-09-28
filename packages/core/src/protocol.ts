/**
 * The wire protocol between the TV, the relay and the phone.
 *
 * One definition, imported by all three, so they cannot drift apart. Every message is JSON
 * with a version and a type, validated by zod at every boundary — the relay drops anything
 * that does not parse, and anything a role is not allowed to send.
 *
 *   TV ("display")  ─┐                      ┌─  phone ("sensor")
 *                    └──  relay (rooms)  ───┘
 *
 * The phone never sends raw sensor samples. It runs the same estimators as the simulator
 * on-device and sends a scored QualityFrame twice a second — a few hundred bytes a second,
 * fine on any home network.
 *
 * `seq` ties a quality frame to the exercise it was measured on. Every time the TV changes
 * movement it bumps `seq`; frames carrying an old `seq` are dropped, so a late frame from
 * Jumping Jacks can never be scored against Step Jacks.
 */

import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

/** Messages larger than this are rejected before parsing. The largest legitimate one is ~300 B. */
export const MAX_MESSAGE_BYTES = 4096;

export const PAIRING_CODE = /^\d{4}$/;

const v = z.literal(PROTOCOL_VERSION);
const role = z.enum(['display', 'sensor']);
const profile = z.enum(['impact', 'oscillation', 'sustained', 'static']);
const phase = z.enum(['idle', 'getready', 'active', 'adapting', 'rest', 'paused', 'complete']);
const unit = z.number().min(0).max(1);

// ---------------------------------------------------------------------------
// Control — between a client and the relay
// ---------------------------------------------------------------------------

export const Hello = z.object({
  v,
  type: z.literal('hello'),
  role,
  /** The sensor joins the display's room by its code. The display never sends one. */
  code: z.string().regex(PAIRING_CODE).optional(),
  /** Reconnect token from a previous `welcome`, to reclaim a seat after a dropped connection. */
  resume: z.string().min(8).max(64).optional(),
  client: z.string().max(64),
});

export const Welcome = z.object({
  v,
  type: z.literal('welcome'),
  role,
  code: z.string().regex(PAIRING_CODE),
  resume: z.string(),
  /** Whether the other role is already in the room. */
  peerPresent: z.boolean(),
});

export const Rejected = z.object({
  v,
  type: z.literal('rejected'),
  reason: z.enum(['bad-hello', 'version', 'unknown-code', 'role-taken', 'too-many-attempts', 'room-full']),
});

/**
 * The other side of the room changed.
 *   joined  arrived (or came back)
 *   left    closed cleanly
 *   lost    stopped answering heartbeats — the TV falls back to solo without stopping
 */
export const Peer = z.object({
  v,
  type: z.literal('peer'),
  role,
  status: z.enum(['joined', 'left', 'lost']),
});

export const Ping = z.object({ v, type: z.literal('ping'), t: z.number() });
export const Pong = z.object({ v, type: z.literal('pong'), t: z.number() });

// ---------------------------------------------------------------------------
// Session — TV → phone
// ---------------------------------------------------------------------------

/** A new movement started. The phone resets its estimator for the new signal shape. */
export const SessionExercise = z.object({
  v,
  type: z.literal('session.exercise'),
  seq: z.number().int().nonnegative(),
  exerciseId: z.string().max(80),
  name: z.string().max(80),
  signalProfile: profile,
  expectedCadence: z.number().positive().nullable(),
  durationSec: z.number().positive(),
});

/** Coarse phase, so the phone knows when to measure and when to rest. */
export const SessionState = z.object({
  v,
  type: z.literal('session.state'),
  seq: z.number().int().nonnegative(),
  phase,
});

/** The workout changed. The phone shows it; it does not act on it. */
export const SessionAdapted = z.object({
  v,
  type: z.literal('session.adapted'),
  seq: z.number().int().nonnegative(),
  from: z.string().max(80),
  to: z.string().max(80),
  trigger: z.enum(['predicted-strain', 'user-correction']),
  reason: z.string().max(160),
});

// ---------------------------------------------------------------------------
// Sensor — phone → TV
// ---------------------------------------------------------------------------

export const SensorFrame = z.object({
  v,
  type: z.literal('sensor.frame'),
  seq: z.number().int().nonnegative(),
  t: z.number(),
  quality: unit,
  cadence: z.number().nonnegative().nullable(),
  confidence: unit,
  profile,
});

/** "easier", spoken or pressed. `heard` is the literal word, so TV-8 can print it as said. */
export const UserCorrection = z.object({
  v,
  type: z.literal('user.correction'),
  direction: z.enum(['easier', 'harder']),
  source: z.enum(['voice', 'button']),
  heard: z.string().max(40).optional(),
});

/** Whether the phone is lying still on the floor — TV-6 waits for this before the first rep. */
export const SensorStatus = z.object({
  v,
  type: z.literal('sensor.status'),
  onFloor: z.boolean(),
});

// ---------------------------------------------------------------------------
// Unions and routing
// ---------------------------------------------------------------------------

export const Message = z.discriminatedUnion('type', [
  Hello,
  Welcome,
  Rejected,
  Peer,
  Ping,
  Pong,
  SessionExercise,
  SessionState,
  SessionAdapted,
  SensorFrame,
  UserCorrection,
  SensorStatus,
]);

export type Message = z.infer<typeof Message>;
export type MessageType = Message['type'];
export type Role = z.infer<typeof role>;
export type MessageOf<T extends MessageType> = Extract<Message, { type: T }>;

/**
 * What each role may send through the relay to its peer. Anything else from a client is
 * dropped — a phone cannot impersonate the TV and push a session, and vice versa.
 */
export const FORWARDABLE: Record<Role, ReadonlySet<MessageType>> = {
  display: new Set(['session.exercise', 'session.state', 'session.adapted']),
  sensor: new Set(['sensor.frame', 'user.correction', 'sensor.status']),
};

/** Payload of a message, without the envelope fields — what callers actually write. */
export type Payload<T extends MessageType> = Omit<MessageOf<T>, 'v' | 'type'>;

export function make<T extends MessageType>(type: T, payload: Payload<T>): MessageOf<T> {
  return { v: PROTOCOL_VERSION, type, ...payload } as unknown as MessageOf<T>;
}

export function encode(message: Message): string {
  return JSON.stringify(message);
}

export type DecodeResult = { ok: true; message: Message } | { ok: false; reason: 'too-large' | 'not-json' | 'invalid' | 'version' };

/** Parse and validate one frame off the wire. Never throws. */
export function decode(raw: string): DecodeResult {
  if (raw.length > MAX_MESSAGE_BYTES) return { ok: false, reason: 'too-large' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (typeof data === 'object' && data !== null && 'v' in data && (data as { v: unknown }).v !== PROTOCOL_VERSION) {
    return { ok: false, reason: 'version' };
  }
  const parsed = Message.safeParse(data);
  return parsed.success ? { ok: true, message: parsed.data } : { ok: false, reason: 'invalid' };
}

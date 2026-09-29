// `seq` ties a frame to the exercise it was measured on; the TV bumps it on every change
// and drops frames carrying an old one.

import { z } from 'zod';

export const PROTOCOL_VERSION = 1;

export const MAX_MESSAGE_BYTES = 4096;

export const PAIRING_CODE = /^\d{4}$/;

const v = z.literal(PROTOCOL_VERSION);
const role = z.enum(['display', 'sensor']);
const profile = z.enum(['impact', 'oscillation', 'sustained', 'static']);
const phase = z.enum(['idle', 'getready', 'active', 'adapting', 'rest', 'paused', 'complete']);
const unit = z.number().min(0).max(1);

export const Hello = z.object({
  v,
  type: z.literal('hello'),
  role,
  /** Sensor only. */
  code: z.string().regex(PAIRING_CODE).optional(),
  /** Token from a previous `welcome`, to reclaim the seat after a drop. */
  resume: z.string().min(8).max(64).optional(),
  client: z.string().max(64),
});

export const Welcome = z.object({
  v,
  type: z.literal('welcome'),
  role,
  code: z.string().regex(PAIRING_CODE),
  resume: z.string(),
  peerPresent: z.boolean(),
});

export const Rejected = z.object({
  v,
  type: z.literal('rejected'),
  reason: z.enum(['bad-hello', 'version', 'unknown-code', 'role-taken', 'too-many-attempts', 'room-full']),
});

/** `lost` means heartbeats stopped; the TV carries on solo. */
export const Peer = z.object({
  v,
  type: z.literal('peer'),
  role,
  status: z.enum(['joined', 'left', 'lost']),
});

export const Ping = z.object({ v, type: z.literal('ping'), t: z.number() });
export const Pong = z.object({ v, type: z.literal('pong'), t: z.number() });

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

export const SessionState = z.object({
  v,
  type: z.literal('session.state'),
  seq: z.number().int().nonnegative(),
  phase,
});

export const SessionAdapted = z.object({
  v,
  type: z.literal('session.adapted'),
  seq: z.number().int().nonnegative(),
  from: z.string().max(80),
  to: z.string().max(80),
  trigger: z.enum(['predicted-strain', 'user-correction']),
  reason: z.string().max(160),
});

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

export const UserCorrection = z.object({
  v,
  type: z.literal('user.correction'),
  direction: z.enum(['easier', 'harder']),
  source: z.enum(['voice', 'button']),
  heard: z.string().max(40).optional(),
});

export const UserCommand = z.object({
  v,
  type: z.literal('user.command'),
  command: z.enum(['pause', 'resume', 'swap']),
  source: z.enum(['voice', 'button']),
  heard: z.string().max(40).optional(),
});

export const SensorStatus = z.object({
  v,
  type: z.literal('sensor.status'),
  onFloor: z.boolean(),
});

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
  UserCommand,
  SensorStatus,
]);

export type Message = z.infer<typeof Message>;
export type MessageType = Message['type'];
export type Role = z.infer<typeof role>;
export type MessageOf<T extends MessageType> = Extract<Message, { type: T }>;

/** What each role may send to its peer; the relay drops everything else. */
export const FORWARDABLE: Record<Role, ReadonlySet<MessageType>> = {
  display: new Set(['session.exercise', 'session.state', 'session.adapted']),
  sensor: new Set(['sensor.frame', 'user.correction', 'user.command', 'sensor.status']),
};

export type Payload<T extends MessageType> = Omit<MessageOf<T>, 'v' | 'type'>;

export function make<T extends MessageType>(type: T, payload: Payload<T>): MessageOf<T> {
  return { v: PROTOCOL_VERSION, type, ...payload } as unknown as MessageOf<T>;
}

export function encode(message: Message): string {
  return JSON.stringify(message);
}

export type DecodeResult = { ok: true; message: Message } | { ok: false; reason: 'too-large' | 'not-json' | 'invalid' | 'version' };

/** Never throws. */
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

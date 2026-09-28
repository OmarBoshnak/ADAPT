/**
 * LiveSession — the TV's brain, without the pixels.
 *
 * Owns the clock, drives the session reducer, talks to the phone through whatever `send`
 * it is given, and exposes one snapshot for the screens to render. The Vega app and the
 * console harness in tools/ run this same class; neither contains session logic of its own.
 *
 * Responsibilities, in the order they matter:
 *
 *   1. Solo is a first-class mode. With no phone, or when the phone goes away mid-set, the
 *      session carries on without a pause and without a warning. The phone's last reading is
 *      discarded (SENSOR_LOST) rather than trusted until the end of the session.
 *   2. Every movement change bumps `seq` and is announced to the phone, which re-baselines.
 *      Frames carrying an old `seq` are dropped here, before they reach the model.
 *   3. A correction — spoken on the phone or pressed on the remote — goes through the same
 *      path, and the literal word is surfaced for the TV-8 "heard" bar.
 */

import { getExercise } from './graph.js';
import type { Message, MessageType, Payload } from './protocol.js';
import type { PeerState } from './relay-client.js';
import {
  createSession,
  projectionFor,
  reduce,
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from './session.js';
import type { Projection } from './strain.js';
import type { CorrectionDirection, CorrectionSource, SessionPlan } from './types.js';

export type Send = <T extends MessageType>(type: T, payload: Payload<T>) => boolean;

export interface LiveSessionOptions {
  ctx: SessionContext;
  plan: SessionPlan;
  /** Outbound to the phone. Omit for a TV with no relay at all. */
  send?: Send;
  /** Milliseconds, monotonic. Injected so tests control time. */
  now?: () => number;
  tickMs?: number;
  /** No frame for this long while working means the phone has gone quiet. */
  staleFrameMs?: number;
  /** A tick never advances more than this, so a backgrounded app does not fast-forward. */
  maxStepSec?: number;
}

export type Mode = 'paired' | 'solo';

export interface LiveSnapshot {
  state: SessionState;
  /** Identifies the movement currently being measured. */
  seq: number;
  mode: Mode;
  /** Phone reports lying still on the floor. Null when unknown or unpaired. */
  onFloor: boolean | null;
  /** The last word heard, for TV-8. The screen decides how long to show it. */
  heard: { word: string; atMs: number } | null;
  paused: boolean;
}

type Listener = (snapshot: LiveSnapshot) => void;

export class LiveSession {
  private readonly ctx: SessionContext;
  private readonly send: Send | undefined;
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly staleFrameMs: number;
  private readonly maxStepSec: number;

  private snap: LiveSnapshot;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt: number | null = null;
  private lastFrameAt: number | null = null;
  private sensorLost = false;
  private announcedKey: string | null = null;
  private listeners = new Set<Listener>();

  constructor(opts: LiveSessionOptions) {
    this.ctx = opts.ctx;
    this.send = opts.send;
    this.now = opts.now ?? (() => Date.now());
    this.tickMs = opts.tickMs ?? 250;
    this.staleFrameMs = opts.staleFrameMs ?? 3000;
    this.maxStepSec = opts.maxStepSec ?? 1;
    this.snap = {
      state: createSession(opts.ctx, opts.plan),
      seq: 0,
      mode: 'solo',
      onFloor: null,
      heard: null,
      paused: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  get snapshot(): LiveSnapshot {
    return this.snap;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.timer) return;
    this.lastTickAt = this.now();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.announceState();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pause(): void {
    if (this.snap.paused || this.snap.state.phase === 'complete') return;
    this.set({ paused: true });
    this.send?.('session.state', { seq: this.snap.seq, phase: 'paused' });
  }

  resume(): void {
    if (!this.snap.paused) return;
    this.lastTickAt = this.now(); // time spent paused is not session time
    this.set({ paused: false });
    this.announceState();
  }

  /** Advance the clock. Called by the interval; public so tests and harnesses can drive it. */
  tick(): void {
    const now = this.now();
    const dt = this.lastTickAt === null ? 0 : Math.min(this.maxStepSec, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    if (this.snap.paused || this.snap.state.phase === 'complete') return;

    if (
      this.snap.mode === 'paired' &&
      this.snap.state.phase === 'active' &&
      !this.sensorLost &&
      this.lastFrameAt !== null &&
      now - this.lastFrameAt > this.staleFrameMs
    ) {
      this.sensorLost = true;
      this.dispatch({ type: 'SENSOR_LOST' });
    }

    if (dt > 0) this.dispatch({ type: 'TICK', dtSec: dt });
    // A method call, not an inline comparison: dispatch() replaced the state, and an inline
    // check would be narrowed away by the early return above.
    if (this.isComplete()) {
      this.stop();
    }
  }

  private isComplete(): boolean {
    return this.snap.state.phase === 'complete';
  }

  // ---------------------------------------------------------------------------
  // Inputs
  // ---------------------------------------------------------------------------

  /** "Easier" or "harder" from the remote. Voice arrives through `receive`. */
  correct(direction: CorrectionDirection, source: CorrectionSource = 'button', heard?: string): void {
    if (this.snap.paused || this.snap.state.phase !== 'active') return;
    const before = this.snap.state.corrections.length;
    this.dispatch(heard !== undefined ? { type: 'CORRECTION', direction, source, heard } : { type: 'CORRECTION', direction, source });
    if (heard !== undefined && this.snap.state.corrections.length > before) {
      this.set({ heard: { word: heard, atMs: this.now() } });
    }
  }

  /** Everything the relay client passes up. */
  receive(message: Message): void {
    switch (message.type) {
      case 'sensor.frame': {
        if (message.seq !== this.snap.seq || this.snap.paused || this.snap.state.phase !== 'active') return;
        this.lastFrameAt = this.now();
        this.sensorLost = false;
        const { t, quality, cadence, confidence, profile } = message;
        this.dispatch({ type: 'QUALITY', frame: { t, quality, cadence, confidence, profile } });
        return;
      }
      case 'user.correction':
        this.correct(message.direction, message.source, message.heard);
        return;
      case 'sensor.status':
        this.set({ onFloor: message.onFloor });
        return;
      case 'peer':
        if (message.role === 'sensor') this.setPeer(message.status === 'joined' ? 'present' : message.status === 'lost' ? 'lost' : 'absent');
        return;
      default:
        return;
    }
  }

  /** Relay status changes. A phone arriving mid-session is caught up immediately. */
  setPeer(peer: PeerState): void {
    if (peer === 'present') {
      const wasSolo = this.snap.mode === 'solo';
      this.lastFrameAt = this.now();
      this.sensorLost = false;
      this.set({ mode: 'paired' });
      if (wasSolo) this.resync();
      return;
    }
    if (this.snap.mode === 'paired') {
      this.dispatch({ type: 'SENSOR_LOST' });
      this.set({ mode: 'solo', onFloor: null });
    }
  }

  /** The forecast behind TV-7's dashed curve. */
  projection(): Projection {
    return projectionFor(this.ctx, this.snap.state);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private set(patch: Partial<LiveSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }

  private dispatch(event: SessionEvent): void {
    const before = this.snap.state;
    const after = reduce(this.ctx, before, event);
    if (after === before) return;
    this.snap = { ...this.snap, state: after };

    if (after.adaptations.length > before.adaptations.length) {
      const a = after.adaptations[after.adaptations.length - 1];
      if (a) {
        this.send?.('session.adapted', {
          seq: this.snap.seq,
          from: getExercise(this.ctx.graph, a.fromExerciseId).name,
          to: getExercise(this.ctx.graph, a.toExerciseId).name,
          trigger: a.trigger,
          reason: a.reason,
        });
      }
    }

    const key = `${after.segmentIndex}:${after.currentExerciseId}`;
    if (after.phase === 'active' && key !== this.announcedKey) {
      this.snap = { ...this.snap, seq: this.snap.seq + 1 };
      this.announcedKey = key;
      this.lastFrameAt = this.now();
      this.sensorLost = false;
      this.announceExercise();
    }
    if (after.phase !== before.phase) this.announceState();

    for (const l of this.listeners) l(this.snap);
  }

  private announceExercise(): void {
    const s = this.snap.state;
    const ex = getExercise(this.ctx.graph, s.currentExerciseId);
    const seg = s.plan.segments[s.segmentIndex];
    this.send?.('session.exercise', {
      seq: this.snap.seq,
      exerciseId: ex.id,
      name: ex.name,
      signalProfile: ex.signalProfile,
      expectedCadence: ex.expectedCadence,
      durationSec: Math.max(1, (seg?.durationSec ?? 1) - s.segmentElapsedSec),
    });
  }

  private announceState(): void {
    this.send?.('session.state', { seq: this.snap.seq, phase: this.snap.paused ? 'paused' : this.snap.state.phase });
  }

  private resync(): void {
    if (this.snap.state.phase === 'active' && this.announcedKey !== null) this.announceExercise();
    this.announceState();
  }
}

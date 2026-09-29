// Owns the clock, drives the reducer and talks to the phone. The screens only render `snapshot`.

import { eligibilityFor } from './contraindications.js';
import { getExercise, resolveAlternatives } from './graph.js';
import type { Message, MessageOf, MessageType, Payload } from './protocol.js';
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
  send?: Send;
  /** Monotonic milliseconds. */
  now?: () => number;
  tickMs?: number;
  staleFrameMs?: number;
  /** Caps a tick so a backgrounded app does not fast-forward. */
  maxStepSec?: number;
}

export type Mode = 'paired' | 'solo';

export type Command = MessageOf<'user.command'>['command'];

export interface LiveSnapshot {
  state: SessionState;
  seq: number;
  mode: Mode;
  /** Null when unknown or unpaired. */
  onFloor: boolean | null;
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

  /** Leaving the session early; the phone would otherwise wait on the last phase it heard. */
  close(): void {
    this.stop();
    if (this.snap.state.phase !== 'complete') this.send?.('session.state', { seq: this.snap.seq, phase: 'idle' });
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
    // A method call so TypeScript does not keep the narrowing from before dispatch().
    if (this.isComplete()) {
      this.stop();
    }
  }

  private isComplete(): boolean {
    return this.snap.state.phase === 'complete';
  }

  correct(direction: CorrectionDirection, source: CorrectionSource = 'button', heard?: string): void {
    if (this.snap.paused || this.snap.state.phase !== 'active') return;
    const before = this.snap.state.corrections.length;
    this.dispatch(heard !== undefined ? { type: 'CORRECTION', direction, source, heard } : { type: 'CORRECTION', direction, source });
    if (heard !== undefined && this.snap.state.corrections.length > before) {
      this.set({ heard: { word: heard, atMs: this.now() } });
    }
  }

  skip(): void {
    if (!this.snap.paused) this.dispatch({ type: 'SKIP' });
  }

  swap(exerciseId: string): void {
    this.dispatch({ type: 'SWAP', exerciseId });
  }

  command(command: Command): void {
    if (command === 'pause') return this.pause();
    if (command === 'resume') return this.resume();
    if (this.snap.paused || this.snap.state.phase !== 'active') return;
    const { different } = resolveAlternatives(
      this.ctx.graph,
      this.snap.state.currentExerciseId,
      eligibilityFor(this.ctx.profile),
    );
    if (different) this.swap(different.id);
  }

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
      case 'user.command':
        this.command(message.command);
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

  projection(): Projection {
    return projectionFor(this.ctx, this.snap.state);
  }

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

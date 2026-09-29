// The phone's side of a session: follows the TV's announcements, scores the floor and reports back.

import type { Send } from './live.js';
import type { Message, MessageOf } from './protocol.js';
import { FloorDetector, QualityEstimator, SAMPLE_RATE } from './signal.js';
import type { SensorSample, SignalProfile } from './types.js';

export type TvPhase = MessageOf<'session.state'>['phase'];

export interface MeasuredExercise {
  seq: number;
  name: string;
  profile: SignalProfile;
  expectedCadence: number | null;
}

export interface SensorSnapshot {
  phase: TvPhase;
  exercise: MeasuredExercise | null;
  onFloor: boolean;
  /** Recent quality, oldest first; null where the signal could not be trusted. */
  trace: Array<number | null>;
  adapted: { from: string; to: string } | null;
}

export interface SensorSessionOptions {
  send: Send;
  sampleRate?: number;
  framesPerSec?: number;
  traceLength?: number;
}

type Listener = (snapshot: SensorSnapshot) => void;

const IDLE: SensorSnapshot = { phase: 'idle', exercise: null, onFloor: false, trace: [], adapted: null };

export class SensorSession {
  private readonly send: Send;
  private readonly samplesPerFrame: number;
  private readonly traceLength: number;
  private readonly floor: FloorDetector;
  private readonly sampleRate: number;
  private estimator: QualityEstimator | null = null;
  private samples = 0;
  private snap: SensorSnapshot = IDLE;
  private listeners = new Set<Listener>();

  constructor(opts: SensorSessionOptions) {
    this.send = opts.send;
    this.sampleRate = opts.sampleRate ?? SAMPLE_RATE;
    this.samplesPerFrame = Math.round(this.sampleRate / (opts.framesPerSec ?? 2));
    this.traceLength = opts.traceLength ?? 60;
    this.floor = new FloorDetector(this.sampleRate);
  }

  get snapshot(): SensorSnapshot {
    return this.snap;
  }

  get measuring(): boolean {
    return this.snap.phase === 'active' && this.estimator !== null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  receive(message: Message): void {
    switch (message.type) {
      case 'session.exercise': {
        // The relay replays and the TV resyncs after a reconnect: same seq, same movement.
        if (this.snap.exercise?.seq === message.seq) return;
        this.estimator = new QualityEstimator({
          profile: message.signalProfile,
          expectedCadence: message.expectedCadence,
          sampleRate: this.sampleRate,
        });
        this.samples = 0;
        this.set({
          exercise: {
            seq: message.seq,
            name: message.name,
            profile: message.signalProfile,
            expectedCadence: message.expectedCadence,
          },
          trace: [],
          adapted: null,
        });
        return;
      }
      case 'session.state':
        if (message.phase === 'getready' || message.phase === 'complete' || message.phase === 'idle') {
          this.estimator = null;
          this.set({ phase: message.phase, exercise: null, adapted: null });
        } else {
          this.set({ phase: message.phase });
        }
        return;
      case 'session.adapted':
        this.set({ adapted: { from: message.from, to: message.to } });
        return;
      case 'peer':
        if (message.role === 'display' && message.status !== 'joined') this.end();
        return;
      default:
        return;
    }
  }

  push(sample: SensorSample): void {
    const wasOnFloor = this.snap.onFloor;
    if (this.floor.push(sample) !== wasOnFloor) {
      this.set({ onFloor: !wasOnFloor });
      this.announceFloor();
    }

    if (!this.measuring || !this.estimator || !this.snap.exercise) return;
    this.estimator.push(sample);
    if (++this.samples % this.samplesPerFrame !== 0) return;

    const f = this.estimator.frame();
    const quality = Math.min(1, Math.max(0, f.quality));
    this.send('sensor.frame', {
      seq: this.snap.exercise.seq,
      t: f.t,
      quality,
      cadence: f.cadence,
      confidence: f.confidence,
      profile: f.profile,
    });
    this.set({ trace: [...this.snap.trace, f.confidence > 0 ? quality : null].slice(-this.traceLength) });
  }

  /** Call after every (re)connect so the TV knows where the phone is. */
  announceFloor(): void {
    this.send('sensor.status', { onFloor: this.snap.onFloor });
  }

  end(): void {
    this.estimator = null;
    this.set({ ...IDLE, onFloor: this.snap.onFloor });
  }

  private set(patch: Partial<SensorSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }
}

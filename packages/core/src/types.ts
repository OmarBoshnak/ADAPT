/**
 * ADAPT domain model.
 *
 * This file is the contract between the engine, the TV app, the phone app and the
 * cloud coach. It contains no logic — only the shapes everything else agrees on.
 *
 * Two rules govern everything here and are worth stating once, loudly:
 *
 *  1. THE PROFILE ONLY EXCLUDES. Height, weight, age, injuries and conditions narrow
 *     which movements are eligible. They are never rendered back to the user, never
 *     scored, never interpreted, and never used to explain or diagnose anything.
 *
 *  2. THERE IS NO CAMERA. Movement quality is derived from phone accelerometer and
 *     gyroscope signal only. Nothing in this system observes the user visually.
 */

// ---------------------------------------------------------------------------
// Exercise corpus
// ---------------------------------------------------------------------------

/**
 * Where an exercise record came from.
 *
 * Free Exercise DB (yuhonas/free-exercise-db, Unlicense) is an excellent *gym*
 * corpus — 876 exercises with real demonstration photographs. It is a poor *home
 * cardio* corpus: only 13 of its entries are equipment-free plyometrics, and only
 * 18 of its 111 body-only exercises have a strictly-easier peer to step down to.
 *
 * So ADAPT supplements it with a small authored pack of no-equipment rhythmic
 * movements that carry hand-authored adaptation edges. Every record declares its
 * origin so the UI and the docs can always tell the truth about provenance.
 */
export type ExerciseSource = 'free-exercise-db' | 'adapt-home-pack';

export type Level = 'beginner' | 'intermediate' | 'expert';

export type Category =
  | 'strength'
  | 'stretching'
  | 'plyometrics'
  | 'powerlifting'
  | 'olympic weightlifting'
  | 'strongman'
  | 'cardio';

export type Force = 'push' | 'pull' | 'static' | null;

export type Mechanic = 'compound' | 'isolation' | null;

/**
 * The shape of a movement's sensor signature.
 *
 * The design spec is explicit that one universal measurement must never be implied:
 * a jump produces sharp discrete peaks, a climber produces continuous oscillation.
 * Each profile gets its own quality estimator in `signal.ts`.
 */
export type SignalProfile = 'impact' | 'oscillation' | 'sustained' | 'static';

/**
 * Tags used exclusively for EXCLUSION by the contraindication table.
 *
 * These describe what a movement *does mechanically*. They never describe who
 * should or should not do it — that mapping lives in `contraindications.ts`, and
 * even there it only ever removes movements from the eligible set.
 */
export type MovementTag =
  | 'plyometric'
  | 'deep-knee-flexion'
  | 'spinal-loading'
  | 'spinal-flexion'
  | 'overhead'
  | 'inverted'
  | 'isometric-hold'
  | 'supine'
  | 'prone'
  | 'high-impact'
  | 'single-leg'
  | 'wrist-loading';

/** A raw record as it appears in the vendored Free Exercise DB JSON. */
export interface RawExercise {
  id: string;
  name: string;
  force: Force;
  level: Level;
  mechanic: Mechanic;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: Category;
  images: string[];
}

/**
 * An exercise after ADAPT's enrichment pass.
 *
 * The dataset supplies CONTENT. ADAPT adds the three fields the adaptation engine
 * needs, because "too hard" and "doesn't suit me" are different problems with
 * different answers.
 */
export interface Exercise extends RawExercise {
  source: ExerciseSource;

  /** Computed load value, 0–10. Input to the strain model. See `intensity.ts`. */
  intensity: number;

  /** Which estimator scores this movement's quality. */
  signalProfile: SignalProfile;

  /** Mechanical descriptors, for exclusion only. */
  tags: MovementTag[];

  /**
   * An easier version of the SAME movement pattern — for when it is too hard.
   * Jumping Jacks → Step Jacks.
   */
  adaptsDownTo: string | null;

  /**
   * A DIFFERENT pattern reaching the same muscles — for when the movement is
   * unsuitable rather than merely hard. Jumping Jacks → Standing March.
   */
  substituteWith: string | null;

  /** Steady-state repetitions per minute, used to seed the signal baseline. */
  expectedCadence: number | null;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type Injury = 'knee' | 'lower back' | 'shoulder' | 'ankle' | 'wrist' | 'neck';

export type Condition =
  | 'high blood pressure'
  | 'asthma'
  | 'heart condition'
  | 'pregnancy'
  | 'joint condition';

export type Energy = 'low' | 'medium' | 'high';

export type IntensityPreference = 'gentle' | 'steady' | 'hard';

export interface TrainerChoice {
  id: string;
  name: string;
  descriptor: string;
}

/**
 * Captured once, on the TV, with a remote. Never re-asked per session.
 *
 * `heightCm` and `weightKg` feed movement selection only. There is deliberately no
 * field here for anything derived from them.
 */
export interface Profile {
  trainerId: string;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  injuries: Injury[];
  conditions: Condition[];
  defaultDurationMin: number;
  intensityPreference: IntensityPreference;

  /**
   * The learned parameter — the whole point of the product.
   *
   * Starts at 1.0. Every time the user corrects the model earlier than it predicted,
   * this drops, and the next session adapts sooner without being asked. Clamped to
   * [0.6, 1.4] so a single odd session can never distort the model beyond recovery.
   */
  personalBias: number;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionSegment {
  exerciseId: string;
  durationSec: number;
}

export interface SessionPlan {
  id: string;
  title: string;
  segments: SessionSegment[];
  totalDurationSec: number;
  /** Which profile exclusions applied, in plain language, for the TV-4 footer. */
  exclusionLabels: string[];
  /** True when this plan came from the local generator rather than the cloud coach. */
  generatedLocally: boolean;
}

export type AdaptationTrigger = 'predicted-strain' | 'user-correction';

export interface Adaptation {
  atSec: number;
  trigger: AdaptationTrigger;
  fromExerciseId: string;
  toExerciseId: string;
  /** Short, human-readable, never a measurement or a verdict on the user. */
  reason: string;
}

export type CorrectionDirection = 'easier' | 'harder';
export type CorrectionSource = 'voice' | 'button';

export interface Correction {
  atSec: number;
  direction: CorrectionDirection;
  source: CorrectionSource;
  /** The literal word recognised, so TV-8 can print it as spoken. */
  heard?: string;
}

export type SessionState =
  | 'setup'
  | 'generating'
  | 'getready'
  | 'active'
  | 'adapting'
  | 'rest'
  | 'complete';

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

/** One raw sample from the phone lying face-up on the floor. */
export interface SensorSample {
  t: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

/**
 * A scored window of movement, emitted by the phone at ~2 Hz.
 *
 * `confidence` drops to 0 when the phone is picked up or otherwise stops being a
 * floor sensor, so the TV can ignore garbage rather than adapt on it.
 */
export interface QualityFrame {
  t: number;
  quality: number;
  cadence: number | null;
  confidence: number;
  profile: SignalProfile;
}

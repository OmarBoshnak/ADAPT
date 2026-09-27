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
 *  2. THERE IS NO CAMERA. Movement quality is derived from the floor vibration a phone
 *     lying beside the user picks up through its accelerometer and gyroscope. Nothing in
 *     this system observes the user visually.
 */

// ---------------------------------------------------------------------------
// Exercise corpus
// ---------------------------------------------------------------------------

/**
 * Where an exercise record came from.
 *
 * Free Exercise DB (yuhonas/free-exercise-db, Unlicense) is an excellent *gym* corpus —
 * 876 exercises with real demonstration photographs. It is a poor *home cardio* corpus:
 * only 13 of its entries are equipment-free plyometrics, and only 18 of its 111 body-only
 * exercises have a strictly-easier peer to step down to.
 *
 * So ADAPT supplements it with an authored pack of no-equipment rhythmic movements that
 * carry hand-authored adaptation edges. Every record declares its origin so the UI and
 * the docs can always tell the truth about provenance.
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
 * The shape of a movement's signature in floor vibration.
 *
 * The design spec is explicit that one universal measurement must never be implied: a
 * jump produces sharp discrete peaks, a stepping rhythm produces a softer periodic signal.
 * Each profile gets its own quality estimator in `signal.ts`.
 *
 *  - impact       jumps, jacks, running in place — strong discrete landings
 *  - oscillation  stepping, marching, climbers — softer periodic footfalls
 *  - sustained    squats, lunges, punches — little floor contact change; weak signal
 *  - static       holds — a phone on the floor cannot sense a hold at all
 */
export type SignalProfile = 'impact' | 'oscillation' | 'sustained' | 'static';

/**
 * Tags used exclusively for EXCLUSION by the contraindication table.
 *
 * These describe what a movement *does mechanically*. They never describe who should or
 * should not do it — that mapping lives in `contraindications.ts`, and even there it only
 * ever removes movements from the eligible set.
 */
export type MovementTag =
  | 'plyometric'
  | 'high-impact'
  | 'deep-knee-flexion'
  | 'spinal-loading'
  | 'spinal-flexion'
  | 'overhead'
  | 'inverted'
  | 'isometric-hold'
  | 'supine'
  | 'prone'
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
 * The dataset supplies CONTENT. ADAPT adds the fields the adaptation engine needs,
 * because "too hard" and "doesn't suit me" are different problems with different answers.
 */
export interface Exercise extends RawExercise {
  source: ExerciseSource;

  /** Load value, 0–10. Input to the strain model. See `intensity.ts`. */
  intensity: number;

  /** Which estimator scores this movement's quality. */
  signalProfile: SignalProfile;

  /** Mechanical descriptors, for exclusion only. */
  tags: MovementTag[];

  /**
   * An easier version of the SAME movement pattern — for when it is too hard.
   * Jumping Jacks → Step Jacks. Null at the bottom of a ladder.
   */
  adaptsDownTo: string | null;

  /**
   * A DIFFERENT pattern reaching the same muscles — for when the movement is unsuitable
   * rather than merely hard. Jumping Jacks → Standing March.
   */
  substituteWith: string | null;

  /** Steady-state repetitions per minute, used for rep targets and signal baselines. */
  expectedCadence: number | null;

  /** Movement-pattern family within the session pool, e.g. "jacks". Null outside it. */
  family: string | null;

  /** One short coaching line, shown under the exercise name on TV-6 and TV-7. */
  cue: string | null;
}

/**
 * The enriched corpus.
 *
 * `sessionPool` lists the movements a living-room session may contain. Everything else
 * in `exercises` exists for breadth and for the open-source adaptation graph, but the
 * generator never selects it.
 */
export interface ExerciseGraph {
  version: string;
  exercises: Record<string, Exercise>;
  sessionPool: string[];
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

/**
 * Captured once, on the TV, with a remote. Never re-asked per session.
 *
 * `heightCm` and `weightKg` are accepted so the profile screen matches the spec, and
 * they are deliberately unused by every function in this package. There is no field
 * here for anything derived from them, and there never will be.
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
   * Starts at 1.0. Every time the user corrects the model earlier than it predicted, this
   * drops, and the next session adapts sooner without being asked. Clamped to [0.6, 1.4]
   * so a single odd session can never distort the model beyond recovery.
   */
  personalBias: number;
}

// ---------------------------------------------------------------------------
// Session plan
// ---------------------------------------------------------------------------

export interface SessionSegment {
  exerciseId: string;
  durationSec: number;
  /** Repetitions expected at the movement's steady cadence. Shown as "7 / 12" on TV-7. */
  targetReps: number;
}

export interface SessionPlan {
  id: string;
  title: string;
  segments: SessionSegment[];
  /** Rest between work segments. */
  restSec: number;
  /** The TV-6 countdown before the first segment. */
  getReadySec: number;
  /** Work plus rests, excluding get-ready. */
  totalDurationSec: number;
  /** Which profile exclusions applied, in plain language, for the TV-4 footer. */
  exclusionLabels: string[];
  /** True when this plan came from the local generator rather than the cloud coach. */
  generatedLocally: boolean;
  /** Seed used for tie-breaking, so a plan can be reproduced exactly. */
  seed: number;
}

// ---------------------------------------------------------------------------
// Session runtime
// ---------------------------------------------------------------------------

export type AdaptationTrigger = 'predicted-strain' | 'user-correction';

/**
 * What an adaptation did.
 *
 *  - switch       moved to `adaptsDownTo` (or a harder rung for "harder")
 *  - end-segment  already at the bottom of the ladder; ended the segment early instead
 */
export type AdaptationAction = 'switch' | 'end-segment';

export interface Adaptation {
  atSec: number;
  /** How far into the movement it fired — the TV-7 ring's position at that moment. */
  segmentElapsedSec: number;
  trigger: AdaptationTrigger;
  action: AdaptationAction;
  fromExerciseId: string;
  toExerciseId: string;
  /** Short, human-readable, never a measurement or a verdict on the user. */
  reason: string;
  /** Strain immediately before the adaptation, for the TV-10 sawtooth. */
  strainBefore: number;
  strainAfter: number;
}

export type CorrectionDirection = 'easier' | 'harder';
export type CorrectionSource = 'voice' | 'button';

export interface Correction {
  atSec: number;
  direction: CorrectionDirection;
  source: CorrectionSource;
  /** The literal word recognised, so TV-8 can print it as spoken. Absent for buttons. */
  heard?: string;
}

/** What one correction taught the model. Drives the TV-10 learning card. */
export interface LearningOutcome {
  direction: CorrectionDirection;
  atSec: number;
  /** When the model expected to adapt, in session seconds. Null if it did not expect to. */
  predictedAtSec: number | null;
  /** How much earlier than predicted the user asked. Zero or positive. */
  earlySec: number;
  biasBefore: number;
  biasAfter: number;
}

export type SessionPhase =
  | 'getready'
  | 'active'
  | 'adapting'
  | 'rest'
  | 'complete';

export interface StrainPoint {
  t: number;
  s: number;
}

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

/**
 * One raw sample from the phone lying face-up on the floor.
 *
 * Units: `t` in seconds, acceleration in g (expo-sensors reports g on iOS), rotation rate
 * in radians per second.
 */
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
 * `confidence` is 0 while a baseline is being captured, when the phone has been picked
 * up, and always for movements a floor sensor cannot perceive. The TV ignores quality
 * below a confidence floor rather than adapting on noise.
 */
export interface QualityFrame {
  t: number;
  quality: number;
  cadence: number | null;
  confidence: number;
  profile: SignalProfile;
}

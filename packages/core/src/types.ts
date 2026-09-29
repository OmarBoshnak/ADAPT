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

/** How a movement shows up in floor vibration; each has its own estimator in `signal.ts`. */
export type SignalProfile = 'impact' | 'oscillation' | 'sustained' | 'static';

/** Mechanical descriptors. Used only to exclude movements, never to recommend them. */
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

export interface Exercise extends RawExercise {
  source: ExerciseSource;
  /** 0–10, the load input to the strain model. */
  intensity: number;
  signalProfile: SignalProfile;
  tags: MovementTag[];
  /** Easier rung of the same pattern — for "too hard". */
  adaptsDownTo: string | null;
  /** Different pattern, same muscles — for "doesn't suit me". */
  substituteWith: string | null;
  /** Reps per minute at steady state. */
  expectedCadence: number | null;
  /** Pattern family within the session pool, e.g. "jacks". */
  family: string | null;
  cue: string | null;
}

export interface ExerciseGraph {
  version: string;
  exercises: Record<string, Exercise>;
  /** The movements a session may contain; the rest of the corpus is never selected. */
  sessionPool: string[];
}

export type Injury = 'knee' | 'lower back' | 'shoulder' | 'ankle' | 'wrist' | 'neck';

export type Condition =
  | 'high blood pressure'
  | 'asthma'
  | 'heart condition'
  | 'pregnancy'
  | 'joint condition';

export type Energy = 'low' | 'medium' | 'high';

export type IntensityPreference = 'gentle' | 'steady' | 'hard';

/** Height and weight are captured but deliberately unused. The profile only ever excludes. */
export interface Profile {
  trainerId: string;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  injuries: Injury[];
  conditions: Condition[];
  defaultDurationMin: number;
  intensityPreference: IntensityPreference;
  /** Learned threshold multiplier, clamped to [0.6, 1.4]. */
  personalBias: number;
}

export interface SessionSegment {
  exerciseId: string;
  durationSec: number;
  targetReps: number;
}

export interface SessionPlan {
  id: string;
  title: string;
  segments: SessionSegment[];
  restSec: number;
  getReadySec: number;
  /** Work plus rests, excluding get-ready. */
  totalDurationSec: number;
  exclusionLabels: string[];
  generatedLocally: boolean;
  seed: number;
}

export type AdaptationTrigger = 'predicted-strain' | 'user-correction';

/** `end-segment` when already at the bottom of the ladder. */
export type AdaptationAction = 'switch' | 'end-segment';

export interface Adaptation {
  atSec: number;
  segmentElapsedSec: number;
  trigger: AdaptationTrigger;
  action: AdaptationAction;
  fromExerciseId: string;
  toExerciseId: string;
  reason: string;
  strainBefore: number;
  strainAfter: number;
}

export type CorrectionDirection = 'easier' | 'harder';
export type CorrectionSource = 'voice' | 'button';

export interface Correction {
  atSec: number;
  direction: CorrectionDirection;
  source: CorrectionSource;
  heard?: string;
}

export interface LearningOutcome {
  direction: CorrectionDirection;
  atSec: number;
  predictedAtSec: number | null;
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

/** Seconds, g, and rad/s. */
export interface SensorSample {
  t: number;
  ax: number;
  ay: number;
  az: number;
  gx: number;
  gy: number;
  gz: number;
}

/** Confidence is 0 during baseline capture, after a pickup, and for static holds. */
export interface QualityFrame {
  t: number;
  quality: number;
  cadence: number | null;
  confidence: number;
  profile: SignalProfile;
}

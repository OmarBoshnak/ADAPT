/** A record as it appears in Free Exercise DB's `dist/exercises.json`. */
export interface RawExercise {
  id: string;
  name: string;
  force: 'push' | 'pull' | 'static' | null;
  level: 'beginner' | 'intermediate' | 'expert';
  mechanic: 'compound' | 'isolation' | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: Category;
  images: string[];
}

export type Category =
  | 'strength'
  | 'stretching'
  | 'plyometrics'
  | 'powerlifting'
  | 'olympic weightlifting'
  | 'strongman'
  | 'cardio';

/** What a movement does mechanically. Meant for excluding movements, e.g. "no jumping". */
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

export interface GraphExercise extends RawExercise {
  /** Relative exertion, 0–10. Orders movements within a pattern; not a physiological measurement. */
  intensity: number;
  tags: MovementTag[];
  /** Movement pattern stem, e.g. "squat" or "push-up". Null when the name matches none. */
  pattern: string | null;
  /** A strictly easier version of the same pattern, same muscles, equipment and category. */
  adaptsDownTo: string | null;
  /** A different pattern working overlapping muscles at a similar or lower intensity. */
  substituteWith: string | null;
}

export interface ExerciseGraph {
  exercises: Record<string, GraphExercise>;
}

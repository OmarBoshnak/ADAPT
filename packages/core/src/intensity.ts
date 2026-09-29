// Ranks the full corpus from dataset fields. The session pool is hand-calibrated in @adapt/data instead,
// since movements like Step Jacks and Toe-Tap Jacks share every field the dataset has.

import type { Category, MovementTag, RawExercise, SignalProfile } from './types.js';

const CATEGORY_BASE: Record<Category, number> = {
  stretching: 1.2,
  strength: 4.0,
  cardio: 5.0,
  plyometrics: 5.5,
  powerlifting: 5.5,
  'olympic weightlifting': 6.0,
  strongman: 6.5,
};

// Kept narrow: the dataset applies `level` inconsistently.
const LEVEL_MULTIPLIER = { beginner: 0.85, intermediate: 1.0, expert: 1.2 } as const;

function mechanicMultiplier(m: RawExercise['mechanic']): number {
  if (m === 'compound') return 1.15;
  if (m === 'isolation') return 0.85;
  return 1.0;
}

const EQUIPMENT_MULTIPLIER: Record<string, number> = {
  barbell: 1.15,
  kettlebells: 1.1,
  dumbbell: 1.05,
  'medicine ball': 1.0,
  'e-z curl bar': 1.0,
  'body only': 1.0,
  other: 1.0,
  machine: 0.95,
  cable: 0.95,
  'exercise ball': 0.9,
  bands: 0.9,
  'foam roll': 0.5,
};

const MUSCLE_MASS: Record<string, number> = {
  quadriceps: 1.15,
  glutes: 1.15,
  hamstrings: 1.15,
  lats: 1.05,
  'middle back': 1.05,
  'lower back': 1.05,
  chest: 1.05,
  shoulders: 0.95,
  traps: 0.95,
  abdominals: 0.9,
  calves: 0.9,
  adductors: 0.9,
  abductors: 0.9,
  biceps: 0.8,
  triceps: 0.8,
  forearms: 0.8,
  neck: 0.8,
};

const SECONDARY_MUSCLE_STEP = 0.03;
const SECONDARY_MUSCLE_CAP = 0.12;

const PLYOMETRIC_BONUS = 1.0;

const PLYOMETRIC_WORDS = /\b(jump|jumps|jumping|hop|hops|bound|bounds|burpee|burpees|plyo|skip|skipping|tuck)\b/i;

function textOf(ex: RawExercise): string {
  return `${ex.name} ${ex.instructions.join(' ')}`;
}

export function isPlyometric(ex: RawExercise): boolean {
  return ex.category === 'plyometrics' || PLYOMETRIC_WORDS.test(ex.name);
}

function muscleMassFactor(ex: RawExercise): number {
  const primary = ex.primaryMuscles.map((m) => MUSCLE_MASS[m] ?? 1.0);
  const largest = primary.length ? Math.max(...primary) : 1.0;
  const secondary = Math.min(ex.secondaryMuscles.length * SECONDARY_MUSCLE_STEP, SECONDARY_MUSCLE_CAP);
  return largest + secondary;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Soft ceiling: a hard clamp at 10 would collapse the ordering of heavy expert lifts.
const SATURATION = 7;
const saturate = (raw: number) => 10 * (1 - Math.exp(-Math.max(0, raw) / SATURATION));

export function computeIntensity(ex: RawExercise): number {
  const base = CATEGORY_BASE[ex.category] ?? CATEGORY_BASE.strength;
  const equipment = EQUIPMENT_MULTIPLIER[ex.equipment ?? 'other'] ?? 1.0;
  const bonus = ex.category !== 'plyometrics' && PLYOMETRIC_WORDS.test(textOf(ex)) ? PLYOMETRIC_BONUS : 0;

  const raw =
    base *
      LEVEL_MULTIPLIER[ex.level] *
      mechanicMultiplier(ex.mechanic) *
      equipment *
      muscleMassFactor(ex) +
    bonus;

  return round1(saturate(raw));
}

interface TagRule {
  tag: MovementTag;
  test: (ex: RawExercise, name: string, text: string) => boolean;
}

const LEG_MOVERS = new Set(['quadriceps', 'glutes', 'hamstrings']);

// Plural-safe: a bare `\bburpee\b` misses "Burpees".
const words = (...patterns: string[]) => new RegExp(`\\b(?:${patterns.join('|')})(?:e?s)?\\b`);

// Deliberately generous: a false positive only removes a movement from someone's options.
const TAG_RULES: TagRule[] = [
  { tag: 'plyometric', test: (ex) => isPlyometric(ex) },
  {
    tag: 'high-impact',
    test: (ex, name) =>
      isPlyometric(ex) &&
      words('tuck', 'bound', 'burpee', 'split jump', 'squat jump', 'jump squat', 'box', 'depth', 'broad', 'long jump', 'star jump').test(name),
  },
  {
    tag: 'deep-knee-flexion',
    test: (ex, name) =>
      ex.primaryMuscles.some((m) => LEG_MOVERS.has(m)) && words('squat', 'lunge', 'pistol', 'split', 'step-?up', 'sissy', 'hack').test(name),
  },
  {
    tag: 'spinal-loading',
    test: (ex, name) =>
      ['powerlifting', 'olympic weightlifting', 'strongman'].includes(ex.category) ||
      (ex.equipment === 'barbell' && words('squat', 'deadlift', 'good morning', 'row', 'clean', 'snatch', 'jerk', 'press').test(name)),
  },
  {
    tag: 'spinal-flexion',
    test: (_ex, name) => words('crunch', 'sit-?up', 'jackknife', 'v-?up', 'toe touch', 'roll-?up', 'toes to bar', 'pike').test(name),
  },
  {
    tag: 'overhead',
    test: (_ex, name, text) =>
      words('overhead', 'military press', 'shoulder press', 'push press', 'snatch', 'jerk', 'handstand', 'arnold').test(name) ||
      /\b(arms|hands) (straight )?(overhead|above your head)\b/.test(text),
  },
  {
    tag: 'inverted',
    test: (_ex, name) => words('handstand', 'headstand', 'inverted', 'decline').test(name),
  },
  {
    tag: 'isometric-hold',
    test: (ex, name) => ex.force === 'static' || words('plank', 'hold', 'wall sit', 'bridge', 'hollow').test(name),
  },
  {
    tag: 'supine',
    test: (_ex, name, text) =>
      words('lying', 'supine', 'floor press', 'glute bridge', 'hip raise', 'dead bug', 'crunch', 'sit-?up', 'leg raise', 'bench press').test(name) ||
      /\blie (flat )?on your back\b/.test(text),
  },
  {
    tag: 'prone',
    test: (_ex, name) => words('plank', 'push-?up', 'pushup', 'prone', 'superman', 'mountain climber', 'burpee', 'bear crawl').test(name),
  },
  {
    tag: 'single-leg',
    test: (_ex, name) => words('single[- ]leg', 'one[- ]leg', 'pistol', 'lunge', 'split', 'step-?up', 'bound').test(name),
  },
  {
    tag: 'wrist-loading',
    test: (_ex, name) =>
      words('push-?up', 'pushup', 'plank', 'mountain climber', 'burpee', 'handstand', 'bear crawl', 'crawl', 'dip').test(name),
  },
];

export function deriveTags(ex: RawExercise): MovementTag[] {
  const name = ex.name.toLowerCase();
  const text = textOf(ex).toLowerCase();
  return TAG_RULES.filter((r) => r.test(ex, name, text)).map((r) => r.tag);
}

export function deriveSignalProfile(ex: RawExercise): SignalProfile {
  const name = ex.name.toLowerCase();
  if (isPlyometric(ex) && !/\bclimb/.test(name)) return 'impact';
  if (/\b(climb|climbers|skip|kick|shuffle|march|jog|run|sprint)\b/.test(name) || ex.category === 'cardio') {
    return 'oscillation';
  }
  if (ex.force === 'static' || ex.category === 'stretching') return 'static';
  return 'sustained';
}

// Most specific first. Muscles and category alone would pair "Sit-Up" with "Wind Sprints".
const PATTERN_STEMS: Array<[string, RegExp]> = [
  ['push-up', /\bpush-?ups?\b|\bpushups\b/],
  ['pull-up', /\b(pull|chin)-?ups?\b/],
  ['sit-up', /\bsit-?ups?\b/],
  ['step-up', /\bstep-?ups?\b/],
  ['deadlift', /\bdeadlift/],
  ['squat', /\bsquat/],
  ['lunge', /\blunge/],
  ['crunch', /\bcrunch/],
  ['plank', /\bplank|\bbridge\b/],
  ['curl', /\bcurl/],
  ['row', /\brow\b|\brows\b/],
  ['press', /\bpress\b/],
  ['fly', /\bfl(y|ye|yes)\b/],
  ['raise', /\braise/],
  ['extension', /\bextension/],
  ['shrug', /\bshrug/],
  ['dip', /\bdips?\b/],
  ['twist', /\btwist/],
  ['clean', /\bclean\b/],
  ['snatch', /\bsnatch/],
  ['swing', /\bswing/],
  ['jump', /\bjump/],
  ['bound', /\bbound/],
  ['hop', /\bhops?\b/],
  ['skip', /\bskip/],
  ['kick', /\bkick/],
  ['climber', /\bclimb/],
  ['stretch', /\bstretch/],
];

export function patternStem(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [stem, re] of PATTERN_STEMS) if (re.test(lower)) return stem;
  return null;
}

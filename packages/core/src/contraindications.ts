// Profile → exclusions. Only ever removes movements; never recommends, explains or grades.
// Conservative on purpose: a wrong exclusion costs variety, a wrong inclusion could cost more.

import type { Condition, Exercise, Injury, MovementTag, Profile } from './types.js';

interface Rule {
  excludeTags: MovementTag[];
  maxIntensity?: number;
  /** Caps segments at or above HIGH_INTENSITY. */
  capHighIntensitySegmentSec?: number;
}

export const HIGH_INTENSITY = 6;

const INJURY_RULES: Record<Injury, Rule> = {
  knee: { excludeTags: ['plyometric', 'high-impact', 'deep-knee-flexion'] },
  'lower back': { excludeTags: ['spinal-loading', 'spinal-flexion'] },
  shoulder: { excludeTags: ['overhead'] },
  ankle: { excludeTags: ['plyometric', 'high-impact', 'single-leg'] },
  wrist: { excludeTags: ['wrist-loading'] },
  neck: { excludeTags: ['spinal-flexion', 'inverted'] },
};

const CONDITION_RULES: Record<Condition, Rule> = {
  'high blood pressure': { excludeTags: ['inverted', 'isometric-hold'] },
  asthma: { excludeTags: [], capHighIntensitySegmentSec: 45 },
  'heart condition': { excludeTags: ['high-impact', 'isometric-hold'], maxIntensity: 5 },
  pregnancy: { excludeTags: ['plyometric', 'high-impact', 'supine', 'prone', 'inverted'] },
  'joint condition': { excludeTags: ['plyometric', 'high-impact', 'deep-knee-flexion'] },
};

// Labels describe the plan, never the person.
const TAG_LABELS: Record<MovementTag, string> = {
  plyometric: 'jumping movements excluded',
  'high-impact': 'hard landings excluded',
  'deep-knee-flexion': 'deep knee bends excluded',
  'spinal-loading': 'loaded back movements excluded',
  'spinal-flexion': 'crunch-style movements excluded',
  overhead: 'overhead movements excluded',
  inverted: 'head-down positions excluded',
  'isometric-hold': 'long holds excluded',
  supine: 'lying-on-back movements excluded',
  prone: 'face-down movements excluded',
  'single-leg': 'single-leg movements excluded',
  'wrist-loading': 'weight on the hands excluded',
};

const LABEL_ORDER: MovementTag[] = [
  'plyometric',
  'high-impact',
  'deep-knee-flexion',
  'overhead',
  'wrist-loading',
  'single-leg',
  'spinal-flexion',
  'spinal-loading',
  'isometric-hold',
  'inverted',
  'supine',
  'prone',
];

export interface Constraints {
  excludedTags: Set<MovementTag>;
  maxIntensity: number;
  highIntensitySegmentCapSec: number | null;
}

function rulesFor(profile: Profile): Rule[] {
  return [
    ...profile.injuries.map((i) => INJURY_RULES[i]),
    ...profile.conditions.map((c) => CONDITION_RULES[c]),
  ];
}

export function constraintsFor(profile: Profile): Constraints {
  const rules = rulesFor(profile);
  const caps = rules.map((r) => r.capHighIntensitySegmentSec).filter((n): n is number => n !== undefined);
  return {
    excludedTags: new Set(rules.flatMap((r) => r.excludeTags)),
    maxIntensity: Math.min(10, ...rules.map((r) => r.maxIntensity ?? 10)),
    highIntensitySegmentCapSec: caps.length ? Math.min(...caps) : null,
  };
}

export function isExcluded(ex: Exercise, constraints: Constraints): boolean {
  if (ex.intensity > constraints.maxIntensity) return true;
  return ex.tags.some((t) => constraints.excludedTags.has(t));
}

export function eligibilityFor(profile: Profile): (ex: Exercise) => boolean {
  const c = constraintsFor(profile);
  return (ex) => !isExcluded(ex, c);
}

/** "hard landings" folds into "jumping" when both apply. */
export function exclusionLabels(profile: Profile): string[] {
  const c = constraintsFor(profile);
  const tags = LABEL_ORDER.filter((t) => c.excludedTags.has(t));
  const folded = tags.filter((t) => !(t === 'high-impact' && c.excludedTags.has('plyometric')));
  const labels = folded.map((t) => TAG_LABELS[t]);
  if (c.maxIntensity < 10) labels.push('high-intensity movements excluded');
  if (c.highIntensitySegmentCapSec !== null) labels.push('high-intensity bursts kept short');
  return labels;
}

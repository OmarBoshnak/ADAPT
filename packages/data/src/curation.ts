/**
 * Free Exercise DB entries promoted into the living-room session pool.
 *
 * Chosen because they need no equipment, fit a living room, put something into the floor,
 * and have a natural easier version in the home pack. Each one heads a ladder that crosses
 * sources — Star Jump (dataset) → Jumping Jacks (home pack) — which is the point: to the
 * engine they are one graph.
 *
 * These keep their real demonstration photographs from the dataset.
 *
 * `extraTags` may only ADD exclusion tags to what the name-based derivation already found.
 * There is no way to remove one from here, by design.
 */

import type { PoolCuration } from '@adapt/core';

export const CURATION: PoolCuration[] = [
  {
    id: 'Star_Jump',
    family: 'jacks',
    intensity: 7.6,
    signalProfile: 'impact',
    expectedCadence: 24,
    adaptsDownTo: 'adapt_jumping_jacks',
    substituteWith: 'adapt_standing_march',
    cue: 'Explode up, land soft and quiet',
    extraTags: ['overhead'],
  },
  {
    id: 'Lateral_Bound',
    family: 'lateral',
    intensity: 7.4,
    signalProfile: 'impact',
    expectedCadence: 30,
    adaptsDownTo: 'adapt_skater_hops',
    substituteWith: 'adapt_high_knee_march',
    cue: 'Stick each landing before the next',
  },
  {
    id: 'Freehand_Jump_Squat',
    family: 'squat',
    intensity: 7.8,
    signalProfile: 'impact',
    expectedCadence: 24,
    adaptsDownTo: 'adapt_squat_calf_raises',
    substituteWith: 'adapt_high_knee_march',
    cue: 'Sit back, jump tall, land quietly',
  },
  {
    id: 'Bodyweight_Squat',
    family: 'squat',
    intensity: 3.9,
    signalProfile: 'sustained',
    expectedCadence: 22,
    adaptsDownTo: null,
    substituteWith: 'adapt_standing_march',
    cue: 'Sit back as far as is comfortable',
  },
  {
    id: 'Double_Leg_Butt_Kick',
    family: 'butt-kick',
    intensity: 7.2,
    signalProfile: 'impact',
    expectedCadence: 36,
    adaptsDownTo: 'adapt_butt_kicks',
    substituteWith: 'adapt_high_knee_march',
    cue: 'Both heels up, soft landing',
    extraTags: ['high-impact'],
  },
  {
    id: 'Split_Jump',
    family: 'lunge',
    intensity: 8.0,
    signalProfile: 'impact',
    expectedCadence: 26,
    adaptsDownTo: 'adapt_alternating_reverse_lunge',
    substituteWith: 'adapt_squat_calf_raises',
    cue: 'Switch in the air, land balanced',
  },
  {
    id: 'Mountain_Climbers',
    family: 'climber',
    intensity: 7.0,
    signalProfile: 'oscillation',
    expectedCadence: 110,
    adaptsDownTo: 'adapt_slow_climbers',
    substituteWith: 'adapt_high_knee_march',
    cue: 'Hips level, knees driving',
  },
];

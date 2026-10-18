// Workout Guide drawings (Bryl Lim, CC BY-SA 4.0), stored unchanged in illustrations/workout-guide.
// Each has three frames, played 1-2-3-2 so one loop is one rep (or one step each side). Movements share a drawing
// only where it shows their shape, and a gentler one only where no frame has both feet off the floor.

export interface IllustrationSource {
  slug: string;
  frameMs: number;
}

export const ILLUSTRATIONS: Record<string, IllustrationSource> = {
  adapt_jumping_jacks: { slug: 'jumping-jack', frameMs: 300 },
  adapt_high_knees: { slug: 'high-knees', frameMs: 260 },
  adapt_high_knee_march: { slug: 'high-knees', frameMs: 340 },
  adapt_burpees: { slug: 'burpee', frameMs: 700 },
  adapt_squat_thrusts: { slug: 'squat-thrust', frameMs: 600 },
  adapt_skater_hops: { slug: 'skater-hop', frameMs: 400 },
  adapt_skater_steps: { slug: 'skater-hop', frameMs: 650 },
  Lateral_Bound: { slug: 'skater-hop', frameMs: 550 },
  Mountain_Climbers: { slug: 'mountain-climber', frameMs: 250 },
  adapt_slow_climbers: { slug: 'mountain-climber', frameMs: 600 },
  Bodyweight_Squat: { slug: 'bodyweight-squat', frameMs: 650 },
  Freehand_Jump_Squat: { slug: 'jump-squat', frameMs: 550 },
  adapt_squat_calf_raises: { slug: 'bodyweight-squat', frameMs: 700 },
  Star_Jump: { slug: 'jumping-jack', frameMs: 380 },
  adapt_step_jacks: { slug: 'jumping-jack', frameMs: 500 },
  adapt_toe_tap_jacks: { slug: 'jumping-jack', frameMs: 600 },
  adapt_standing_march: { slug: 'high-knees', frameMs: 420 },
  adapt_alternating_reverse_lunge: { slug: 'forward-lunge', frameMs: 700 },
  Split_Jump: { slug: 'forward-lunge', frameMs: 450 },
  adapt_step_back_burpees: { slug: 'half-burpee', frameMs: 750 },
  adapt_side_step_touch: { slug: 'lateral-shuffle', frameMs: 600 },
};

// Drawn for ADAPT by tools/figures, in illustrations/adapt, where no Workout Guide drawing shows the movement.
export const FIGURES: Record<string, IllustrationSource> = {
  adapt_butt_kicks: { slug: 'butt-kick', frameMs: 280 },
  adapt_butt_kick_march: { slug: 'butt-kick', frameMs: 450 },
  Double_Leg_Butt_Kick: { slug: 'double-butt-kick', frameMs: 420 },
  adapt_boxer_shuffle: { slug: 'boxer-shuffle', frameMs: 300 },
  adapt_standing_punches: { slug: 'standing-punches', frameMs: 420 },
  adapt_step_punch: { slug: 'step-punch', frameMs: 520 },
  adapt_standing_climbers: { slug: 'standing-climber', frameMs: 520 },
  adapt_reverse_toe_taps: { slug: 'reverse-toe-tap', frameMs: 620 },
};

export const ILLUSTRATION_SOURCE = {
  name: 'Workout Guide',
  creator: 'Bryl Lim',
  url: 'https://github.com/bryllim/workout-guide',
  commit: 'aac599224bb9780305239607ef98540b7e0ce389',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export const ILLUSTRATION_CREDIT = 'Exercise drawings: Workout Guide by Bryl Lim · CC BY-SA 4.0';

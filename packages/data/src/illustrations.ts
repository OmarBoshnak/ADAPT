// Workout Guide drawings (Bryl Lim, CC BY-SA 4.0), stored unchanged in illustrations/workout-guide.
// Each has three frames, played 1-2-3-2 so one loop is one rep (or one step each side). A gentler version shares
// its parent's drawing only where no frame shows both feet off the floor, and plays it slower.

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

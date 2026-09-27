import { describe, expect, it } from 'vitest';

import { computeIntensity, deriveSignalProfile, deriveTags, isPlyometric, patternStem } from './intensity.js';
import type { RawExercise } from './types.js';

const raw = (p: Partial<RawExercise> & Pick<RawExercise, 'name'>): RawExercise => ({
  id: p.name.replace(/\W+/g, '_'),
  force: 'push',
  level: 'beginner',
  mechanic: 'compound',
  equipment: 'body only',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
  ...p,
});

describe('computeIntensity — orderings any coach would agree with', () => {
  it('loaded beats unloaded', () => {
    expect(computeIntensity(raw({ name: 'Barbell Squat', equipment: 'barbell' }))).toBeGreaterThan(
      computeIntensity(raw({ name: 'Bodyweight Squat' })),
    );
  });

  it('expert beats beginner, all else equal', () => {
    expect(computeIntensity(raw({ name: 'A', level: 'expert' }))).toBeGreaterThan(computeIntensity(raw({ name: 'A' })));
  });

  it('compound beats isolation', () => {
    expect(computeIntensity(raw({ name: 'A' }))).toBeGreaterThan(computeIntensity(raw({ name: 'A', mechanic: 'isolation' })));
  });

  it('legs beat arms', () => {
    expect(computeIntensity(raw({ name: 'A' }))).toBeGreaterThan(computeIntensity(raw({ name: 'A', primaryMuscles: ['biceps'] })));
  });

  it('a jump costs more than its category implies', () => {
    expect(computeIntensity(raw({ name: 'Jump Squat' }))).toBeGreaterThan(computeIntensity(raw({ name: 'Squat' })));
  });

  it('stretching is light', () => {
    expect(computeIntensity(raw({ name: 'Quad Stretch', category: 'stretching' }))).toBeLessThan(2.5);
  });

  it('never pins at the ceiling, so the heaviest lifts stay ordered', () => {
    const heavy = raw({ name: 'Heavy', category: 'strongman', level: 'expert', equipment: 'barbell', secondaryMuscles: ['a', 'b', 'c', 'd', 'e'] });
    const heavier = { ...heavy, name: 'Heavier', category: 'olympic weightlifting' as const };
    expect(computeIntensity(heavy)).toBeLessThan(10);
    expect(computeIntensity(heavy)).not.toBe(computeIntensity(heavier));
  });
});

describe('deriveTags — generous by design', () => {
  it('flags a burpee on every count', () => {
    expect(deriveTags(raw({ name: 'Burpees', category: 'plyometrics' }))).toEqual(
      expect.arrayContaining(['plyometric', 'high-impact', 'prone', 'wrist-loading']),
    );
  });

  it('flags crunches as spinal flexion, lying on the back', () => {
    expect(deriveTags(raw({ name: 'Crunches', primaryMuscles: ['abdominals'] }))).toEqual(
      expect.arrayContaining(['spinal-flexion', 'supine']),
    );
  });

  it('flags a plank as a face-down hold on the hands', () => {
    expect(deriveTags(raw({ name: 'Plank', force: 'static', primaryMuscles: ['abdominals'] }))).toEqual(
      expect.arrayContaining(['isometric-hold', 'prone', 'wrist-loading']),
    );
  });

  it('flags deep knee bends only when the legs are the movers', () => {
    expect(deriveTags(raw({ name: 'Split Squat' }))).toContain('deep-knee-flexion');
    expect(deriveTags(raw({ name: 'Squat Rack Curl', primaryMuscles: ['biceps'] }))).not.toContain('deep-knee-flexion');
  });

  it('flags overhead from instructions as well as names', () => {
    expect(deriveTags(raw({ name: 'Reach', instructions: ['Raise your arms overhead.'] }))).toContain('overhead');
  });

  it('does not let plurals slip past a rule', () => {
    expect(deriveTags(raw({ name: 'Walking Lunges' }))).toEqual(expect.arrayContaining(['deep-knee-flexion', 'single-leg']));
    expect(deriveTags(raw({ name: 'Sit Squats' }))).toContain('deep-knee-flexion');
    expect(deriveTags(raw({ name: 'Planks', force: 'static', primaryMuscles: ['abdominals'] }))).toContain('prone');
    expect(deriveTags(raw({ name: 'Bench Dips', primaryMuscles: ['triceps'] }))).toContain('wrist-loading');
  });

  it('flags nothing on a plain march', () => {
    expect(deriveTags(raw({ name: 'Standing March', category: 'cardio' }))).toEqual([]);
  });
});

describe('deriveSignalProfile — what a floor can feel', () => {
  it('maps jumps to impact, stepping to oscillation, holds to static', () => {
    expect(deriveSignalProfile(raw({ name: 'Star Jump', category: 'plyometrics' }))).toBe('impact');
    expect(deriveSignalProfile(raw({ name: 'Mountain Climbers', category: 'plyometrics' }))).toBe('oscillation');
    expect(deriveSignalProfile(raw({ name: 'Wall Sit', force: 'static' }))).toBe('static');
    expect(deriveSignalProfile(raw({ name: 'Hamstring Stretch', category: 'stretching' }))).toBe('static');
    expect(deriveSignalProfile(raw({ name: 'Bodyweight Squat' }))).toBe('sustained');
  });

  it('agrees with isPlyometric', () => {
    expect(isPlyometric(raw({ name: 'Box Skip' }))).toBe(true);
    expect(isPlyometric(raw({ name: 'Goblet Squat' }))).toBe(false);
  });
});

describe('patternStem', () => {
  it('finds the most specific movement pattern', () => {
    expect(patternStem('Decline Push-Up')).toBe('push-up');
    expect(patternStem('3/4 Sit-Up')).toBe('sit-up');
    expect(patternStem('Barbell Full Squat')).toBe('squat');
    expect(patternStem('Wind Sprints')).toBeNull();
  });
});

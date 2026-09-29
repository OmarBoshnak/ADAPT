import {useCallback, useEffect, useState} from 'react';
import {AsyncStorage} from '@amazon-devices/react-native-kepler';
import type {Profile} from '@adapt/core';

export type Stats = {sessions: number; adaptations: number};
export type Stored = {profile: Profile; stats: Stats};

const KEY = 'adapt.v1';

export const DEFAULT_PROFILE: Profile = {
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: [],
  conditions: [],
  defaultDurationMin: 12,
  intensityPreference: 'steady',
  personalBias: 1,
};

async function load(): Promise<Stored | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<Stored>;
  if (!parsed.profile || !parsed.stats) return null;
  return {profile: {...DEFAULT_PROFILE, ...parsed.profile}, stats: parsed.stats};
}

/** `stored` is undefined while loading and null when nothing has been saved yet. */
export function useStore() {
  const [stored, setStored] = useState<Stored | null | undefined>(undefined);

  useEffect(() => {
    load()
      .then(setStored)
      .catch(() => setStored(null));
  }, []);

  const save = useCallback((next: Stored) => {
    setStored(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  return {stored, save};
}

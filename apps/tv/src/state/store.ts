import {useCallback, useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
  if (!parsed?.profile || !parsed.stats) {
    console.log('[adapt] loaded · nothing saved');
    return null;
  }
  const stored = {profile: {...DEFAULT_PROFILE, ...parsed.profile}, stats: parsed.stats};
  console.log(`[adapt] loaded · bias ${stored.profile.personalBias.toFixed(2)} · ${stored.stats.sessions} sessions`);
  return stored;
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
    AsyncStorage.setItem(KEY, JSON.stringify(next))
      .then(() => console.log(`[adapt] saved · bias ${next.profile.personalBias.toFixed(2)} · ${next.stats.sessions} sessions`))
      .catch(e => console.warn(`[adapt] save failed · ${String(e)}`));
  }, []);

  return {stored, save};
}

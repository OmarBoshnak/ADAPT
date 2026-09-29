import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Brightness from 'expo-brightness';

const FLOOR_BRIGHTNESS = 0.04;

/** Dims the screen while the phone lies on the floor, so it does not light the room. */
export function useFloorDim(dim: boolean): void {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const original = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!dim || !foreground) return;
    let cancelled = false;
    Brightness.getBrightnessAsync()
      .then((level) => {
        if (cancelled) return;
        original.current ??= level;
        return Brightness.setBrightnessAsync(FLOOR_BRIGHTNESS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (original.current === null) return;
      Brightness.setBrightnessAsync(original.current).catch(() => {});
      original.current = null;
    };
  }, [dim, foreground]);
}

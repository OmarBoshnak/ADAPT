import { useEffect, useRef, useState } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { SAMPLE_RATE, type SensorSample } from '@adapt/core';

const INTERVAL_MS = 1000 / SAMPLE_RATE;

const available = (sensor: { isAvailableAsync(): Promise<boolean> }) => sensor.isAvailableAsync().catch(() => false);

/** Streams accelerometer samples at 50 Hz, each paired with the latest gyroscope reading. */
export function useMotion(onSample: (sample: SensorSample) => void): boolean | null {
  const [hasMotion, setHasMotion] = useState<boolean | null>(null);
  const handler = useRef(onSample);
  handler.current = onSample;

  useEffect(() => {
    let cancelled = false;
    const subscriptions: Array<{ remove(): void }> = [];

    Promise.all([available(Accelerometer), available(Gyroscope)]).then(([accelerometer, gyroscope]) => {
      if (cancelled) return;
      setHasMotion(accelerometer);
      if (!accelerometer) return;

      let rotation = { x: 0, y: 0, z: 0 };
      if (gyroscope) {
        Gyroscope.setUpdateInterval(INTERVAL_MS);
        subscriptions.push(Gyroscope.addListener((m) => (rotation = m)));
      }
      Accelerometer.setUpdateInterval(INTERVAL_MS);
      subscriptions.push(
        Accelerometer.addListener((m) =>
          handler.current({ t: m.timestamp, ax: m.x, ay: m.y, az: m.z, gx: rotation.x, gy: rotation.y, gz: rotation.z }),
        ),
      );
    });

    return () => {
      cancelled = true;
      subscriptions.forEach((s) => s.remove());
    };
  }, []);

  return hasMotion;
}

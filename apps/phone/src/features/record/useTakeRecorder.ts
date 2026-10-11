import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { FloorDetector, measuredRate, packTrace, TAKE_SECONDS, type SensorSample, type TraceMeta } from '@adapt/core';

import { useMotion } from '~/hooks/useMotion';
import { uploadTrace } from '~/state/traces';

const COUNTDOWN_MS = 5000;
const TICK_MS = 250;

export type Stage =
  | { kind: 'placing' }
  | { kind: 'countdown'; endsAt: number }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'uploading' }
  | { kind: 'saved'; file: string; rate: number | null }
  | { kind: 'failed'; rate: number | null };

type Meta = Omit<TraceMeta, 'device' | 'recordedAt'>;

/** Waits for the phone to settle on the floor, counts in, records one take and uploads it. */
export function useTakeRecorder(meta: Meta) {
  const [stage, setStage] = useState<Stage>({ kind: 'placing' });
  const [now, setNow] = useState(Date.now());
  const floor = useRef(new FloorDetector());
  const samples = useRef<SensorSample[]>([]);
  const recording = useRef(false);

  const hasMotion = useMotion((sample) => {
    const onFloor = floor.current.push(sample);
    if (recording.current) samples.current.push(sample);
    else if (onFloor) setStage((s) => (s.kind === 'placing' ? { kind: 'countdown', endsAt: Date.now() + COUNTDOWN_MS } : s));
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const upload = () => {
    const rate = measuredRate(samples.current);
    const trace = packTrace(
      { ...meta, device: `${Platform.OS} ${Platform.Version}`, recordedAt: new Date().toISOString() },
      samples.current,
    );
    setStage({ kind: 'uploading' });
    uploadTrace(trace).then(
      (file) => setStage({ kind: 'saved', file, rate }),
      () => setStage({ kind: 'failed', rate }),
    );
  };

  useEffect(() => {
    if (stage.kind === 'countdown' && now >= stage.endsAt) {
      samples.current = [];
      recording.current = true;
      setStage({ kind: 'recording', startedAt: now });
    } else if (stage.kind === 'recording' && now - stage.startedAt >= TAKE_SECONDS[meta.take] * 1000) {
      recording.current = false;
      upload();
    }
  }, [now, stage]);

  const elapsedSec = stage.kind === 'recording' ? (now - stage.startedAt) / 1000 : 0;
  const countdownSec = stage.kind === 'countdown' ? Math.max(1, Math.ceil((stage.endsAt - now) / 1000)) : 0;
  return { stage, elapsedSec, countdownSec, hasMotion, retry: upload };
}

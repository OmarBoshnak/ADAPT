import { useEffect, useState } from 'react';

const SHOW_MS = 2500;

/** Briefly shows the last word the phone acted on. */
export function useEcho(): [string | null, (word: string) => void] {
  const [echo, setEcho] = useState<{ word: string; at: number } | null>(null);

  useEffect(() => {
    if (!echo) return;
    const timer = setTimeout(() => setEcho(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [echo]);

  return [echo?.word ?? null, (word) => setEcho({ word, at: Date.now() })];
}

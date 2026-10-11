import { useEffect, useState } from 'react';
import type { Trace } from '@adapt/core';

import { relayHttpUrl } from '~/config';

const PROBE_MS = 2500;

/** True when the relay was started with --record. */
export function useRecordingAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_MS);
    fetch(`${relayHttpUrl}/traces`, { signal: controller.signal })
      .then((res) => setAvailable(res.ok))
      .catch(() => setAvailable(false))
      .finally(() => clearTimeout(timer));
    return () => controller.abort();
  }, []);

  return available;
}

export async function uploadTrace(trace: Trace): Promise<string> {
  const res = await fetch(`${relayHttpUrl}/traces`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(trace),
  });
  if (!res.ok) throw new Error(`Relay refused the trace (${res.status})`);
  const { saved } = (await res.json()) as { saved: string };
  return saved;
}

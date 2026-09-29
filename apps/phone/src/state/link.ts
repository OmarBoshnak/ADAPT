import { useEffect, useState } from 'react';
import {
  RelayClient,
  SensorSession,
  type Command,
  type CorrectionDirection,
  type RelayStatus,
  type SensorSample,
  type SensorSnapshot,
} from '@adapt/core';

import { relayUrl } from '~/config';

export interface SensorLink {
  status: RelayStatus;
  snapshot: SensorSnapshot;
  push: (sample: SensorSample) => void;
  correct: (direction: CorrectionDirection, heard?: string) => void;
  command: (command: Command, heard?: string) => void;
}

export function useSensorLink(code: string): SensorLink {
  const [{ client, session }] = useState(() => {
    const session = new SensorSession({ send: (type, payload) => client.send(type, payload) });
    const client = new RelayClient({
      url: relayUrl,
      role: 'sensor',
      code,
      client: 'adapt-phone/0.1',
      onStatus: (next) => {
        setStatus(next);
        if (next.connection === 'open') session.announceFloor();
      },
      onMessage: (message) => session.receive(message),
    });
    return { client, session };
  });
  const [status, setStatus] = useState<RelayStatus>(client.status);
  const [snapshot, setSnapshot] = useState(session.snapshot);

  useEffect(() => session.subscribe(setSnapshot), [session]);

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  return {
    status,
    snapshot,
    push: (sample) => session.push(sample),
    correct: (direction, heard) =>
      client.send('user.correction', heard ? { direction, source: 'voice', heard } : { direction, source: 'button' }),
    command: (command, heard) =>
      client.send('user.command', heard ? { command, source: 'voice', heard } : { command, source: 'button' }),
  };
}

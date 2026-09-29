import React, {createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {RelayClient, type protocol, type RelayStatus, type Send} from '@adapt/core';

type Listener = (message: protocol.Message) => void;

type Relay = {
  status: RelayStatus;
  send: Send;
  subscribe: (listener: Listener) => () => void;
};

const RelayContext = createContext<Relay | null>(null);

export function RelayProvider({url, children}: {url: string; children: ReactNode}) {
  const listeners = useRef(new Set<Listener>());
  const [client] = useState(
    () =>
      new RelayClient({
        url,
        role: 'display',
        client: 'adapt-tv',
        onStatus: status => setStatus(status),
        onMessage: message => listeners.current.forEach(l => l(message)),
      }),
  );
  const [status, setStatus] = useState<RelayStatus>(client.status);

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  const value = useMemo<Relay>(
    () => ({
      status,
      send: (type, payload) => client.send(type, payload),
      subscribe: listener => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [status, client],
  );

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay(): Relay {
  const relay = useContext(RelayContext);
  if (!relay) throw new Error('useRelay must be used inside RelayProvider');
  return relay;
}

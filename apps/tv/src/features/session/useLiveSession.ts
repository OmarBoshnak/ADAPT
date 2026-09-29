import {useEffect, useState} from 'react';
import {LiveSession, type SessionContext, type SessionPlan} from '@adapt/core';

import {useRelay} from '~/state/relay';

export function useLiveSession(ctx: SessionContext, plan: SessionPlan) {
  const relay = useRelay();
  const [live] = useState(() => new LiveSession({ctx, plan, send: relay.send}));
  const [snapshot, setSnapshot] = useState(live.snapshot);

  useEffect(() => {
    const unsubscribe = live.subscribe(setSnapshot);
    const unlisten = relay.subscribe(message => live.receive(message));
    live.start();
    return () => {
      unsubscribe();
      unlisten();
      live.close();
    };
  }, [live]);

  useEffect(() => {
    live.setPeer(relay.status.peer);
  }, [live, relay.status.peer]);

  return {live, snapshot};
}

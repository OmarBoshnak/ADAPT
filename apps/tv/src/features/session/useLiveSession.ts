import {useEffect, useState} from 'react';
import {LiveSession, sessionLog, type SessionContext, type SessionPlan, type SessionState} from '@adapt/core';

import {useRelay} from '~/state/relay';

export function useLiveSession(ctx: SessionContext, plan: SessionPlan) {
  const relay = useRelay();
  const [live] = useState(() => new LiveSession({ctx, plan, send: relay.send}));
  const [snapshot, setSnapshot] = useState(live.snapshot);

  useEffect(() => {
    let previous: SessionState | null = null;
    const unsubscribe = live.subscribe(next => {
      setSnapshot(next);
      for (const line of sessionLog(ctx, previous, next.state)) console.log(`[adapt] ${line}`);
      previous = next.state;
    });
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

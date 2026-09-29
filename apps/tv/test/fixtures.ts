import {
  createSession,
  generatePlan,
  reduce,
  type LiveSnapshot,
  type Profile,
  type SessionContext,
  type SessionEvent,
  type SessionState,
} from '@adapt/core';

import {graph} from '~/exercises/catalog';
import {DEFAULT_PROFILE} from '~/state/store';

export const profile = (patch: Partial<Profile> = {}): Profile => ({...DEFAULT_PROFILE, ...patch});

export function session(patch: Partial<Profile> = {}) {
  const ctx: SessionContext = {graph, profile: profile(patch), energy: 'medium'};
  const plan = generatePlan({graph, profile: ctx.profile, durationMin: 12, energy: 'medium', seed: 5});
  let state = createSession(ctx, plan);
  const send = (event: SessionEvent) => (state = reduce(ctx, state, event));
  const tickUntil = (done: (s: SessionState) => boolean, limit = 2000) => {
    for (let i = 0; i < limit && !done(state); i++) send({type: 'TICK', dtSec: 1});
  };
  return {ctx, plan, get state() {
    return state;
  }, send, tickUntil};
}

export const snapshot = (state: SessionState, mode: LiveSnapshot['mode'] = 'solo'): LiveSnapshot => ({
  state,
  seq: 1,
  mode,
  onFloor: null,
  heard: null,
  paused: false,
});

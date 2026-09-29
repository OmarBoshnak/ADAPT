import React, {useEffect, useRef} from 'react';
import {eligibilityFor, resolveAlternatives, type SessionContext, type SessionPlan, type SessionState} from '@adapt/core';

import {exercise, graph} from '~/exercises/catalog';
import {useBack} from '~/hooks/useBack';
import {useRemote} from '~/hooks/useRemote';
import {ActiveScreen} from './ActiveScreen';
import {GetReadyScreen} from './GetReadyScreen';
import {SwapScreen} from './SwapScreen';
import {useLiveSession} from './useLiveSession';

type Props = {ctx: SessionContext; plan: SessionPlan; onComplete: (state: SessionState) => void};

export function SessionFlow({ctx, plan, onComplete}: Props) {
  const {live, snapshot} = useLiveSession(ctx, plan);
  const s = snapshot.state;
  const swapping = snapshot.paused;
  const reported = useRef(false);
  const report = useRef(onComplete);
  report.current = onComplete;

  const finish = (state: SessionState) => {
    if (reported.current) return;
    reported.current = true;
    report.current(state);
  };

  useEffect(() => {
    if (s.phase === 'complete') finish(s);
  });

  const openSwap = () => live.pause();
  const closeSwap = () => live.resume();

  useBack(() => (swapping ? closeSwap() : openSwap()));

  useRemote(key => {
    if (swapping || s.phase !== 'active') return;
    if (key === 'down') live.correct('easier', 'button');
    else if (key === 'up') live.correct('harder', 'button');
    else if (key === 'playpause' || key === 'pause' || key === 'menu') openSwap();
    else if (key === 'skip_forward' || key === 'forward') live.skip();
  });

  if (swapping) {
    const current = exercise(s.currentExerciseId);
    const {easier, different} =
      s.phase === 'active' ? resolveAlternatives(graph, current.id, eligibilityFor(ctx.profile)) : {easier: null, different: null};
    return (
      <SwapScreen
        current={current}
        easier={easier}
        different={different}
        paired={snapshot.mode === 'paired'}
        onKeep={closeSwap}
        onEnd={() => finish(s)}
        onEasier={() => {
          closeSwap();
          live.correct('easier', 'button');
        }}
        onDifferent={() => {
          if (different) live.swap(different.id);
          closeSwap();
        }}
      />
    );
  }

  if (s.phase === 'getready' || s.phase === 'rest') {
    const next = s.phase === 'rest' ? s.plan.segments[s.segmentIndex + 1]?.exerciseId : s.currentExerciseId;
    return (
      <GetReadyScreen
        resting={s.phase === 'rest'}
        remaining={s.phaseRemainingSec}
        next={exercise(next ?? s.currentExerciseId)}
        paired={snapshot.mode === 'paired'}
      />
    );
  }

  return <ActiveScreen snapshot={snapshot} projection={live.projection()} />;
}

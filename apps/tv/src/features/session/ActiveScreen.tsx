import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ADAPTING_SEC, type LiveSnapshot, type Projection, type SessionSegment} from '@adapt/core';

import {exercise} from '~/exercises/catalog';
import {ExerciseVisual} from '~/exercises/ExerciseVisual';
import {colors, px, type} from '~/theme';
import {Screen} from '~/ui/Screen';
import {BottomBar} from './BottomBar';
import {CountdownRing} from './CountdownRing';
import {DecisionPanel} from './DecisionPanel';
import {ListeningBar} from './ListeningBar';
import {StrainCurve} from './StrainCurve';
import {TopBar} from './TopBar';

// The movement is the screen's largest element: it has to read from the sofa.
const VISUAL = 560;
const CHART = 640;

type Props = {snapshot: LiveSnapshot; projection: Projection};

export function ActiveScreen({snapshot, projection}: Props) {
  const s = snapshot.state;
  const seg = s.plan.segments[s.segmentIndex] as SessionSegment;
  const current = exercise(s.currentExerciseId);
  const nextSeg = s.plan.segments[s.segmentIndex + 1];
  const pending = s.phase === 'adapting' ? s.pending : null;
  const noticed = pending?.trigger === 'predicted-strain';
  const learned = pending?.trigger === 'user-correction';
  const correction = s.corrections[s.corrections.length - 1];

  const history = s.strainSeries.concat({t: s.sessionElapsedSec, s: s.strain});
  const forecast = projection.curve.map(p => ({t: s.sessionElapsedSec + p.dt, s: p.s}));
  const duration = s.plan.totalDurationSec + s.adaptations.length * ADAPTING_SEC;

  return (
    <Screen warm={noticed}>
      <View style={[styles.content, noticed && styles.dimmed]}>
        <TopBar title={s.plan.title} index={s.segmentIndex} count={s.plan.segments.length} progress={s.segmentElapsedSec / seg.durationSec} />
        <View style={styles.stage}>
          <ExerciseVisual exercise={current} size={VISUAL} rounded={px(24)} animate />
          <View style={styles.middle}>
            <View>
              <Text style={type.eyebrow(26)}>Current exercise</Text>
              <Text style={styles.name} numberOfLines={2}>{current.name}</Text>
              {current.cue && <Text style={styles.cue}>{current.cue}</Text>}
            </View>
            <StrainCurve history={history} forecast={forecast} threshold={s.T} duration={duration} atThreshold={noticed} width={CHART} />
          </View>
          <View style={styles.right}>
            <CountdownRing remaining={seg.durationSec - s.segmentElapsedSec} total={seg.durationSec} />
            <Text style={styles.reps}>
              {Math.floor(s.repsThisSegment)}
              <Text style={styles.repsTotal}>{` / ${seg.targetReps}`}</Text>
            </Text>
            <Text style={styles.repsLabel}>Estimated reps</Text>
          </View>
        </View>
        <BottomBar upNext={nextSeg ? exercise(nextSeg.exerciseId).name : null} paired={snapshot.mode === 'paired'} />
      </View>
      {noticed && pending && <DecisionPanel adaptation={pending} startsIn={s.phaseRemainingSec} />}
      {learned && <ListeningBar word={correction?.heard ?? correction?.direction ?? 'easier'} spoken={correction?.source === 'voice'} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1},
  dimmed: {opacity: 0.35},
  stage: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: px(56)},
  middle: {flex: 1, gap: px(48)},
  name: {...type.display(72), marginTop: px(4)},
  cue: {...type.body(34), marginTop: px(12)},
  right: {width: px(400), alignItems: 'center'},
  reps: {...type.title(72), marginTop: px(48)},
  repsTotal: {color: colors.textDim},
  repsLabel: {...type.eyebrow(24), marginTop: px(8)},
});

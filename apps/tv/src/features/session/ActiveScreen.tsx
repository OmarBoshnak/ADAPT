import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {ADAPTING_SEC, type LiveSnapshot, type Projection, type SessionSegment} from '@adapt/core';

import {exercise} from '~/exercises/catalog';
import {ExercisePhoto} from '~/exercises/ExercisePhoto';
import {colors, px, type} from '~/theme';
import {Screen} from '~/ui/Screen';
import {BottomBar} from './BottomBar';
import {CountdownRing} from './CountdownRing';
import {DecisionPanel} from './DecisionPanel';
import {ListeningBar} from './ListeningBar';
import {StrainCurve} from './StrainCurve';
import {TopBar} from './TopBar';

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
          <View style={styles.left}>
            <View style={styles.exercise}>
              <ExercisePhoto exercise={current} size={240} rounded={px(20)} />
              <View style={styles.names}>
                <Text style={type.eyebrow(26)}>Current exercise</Text>
                <Text style={styles.name} numberOfLines={2}>{current.name}</Text>
                {current.cue && <Text style={styles.cue}>{current.cue}</Text>}
              </View>
            </View>
            <StrainCurve history={history} forecast={forecast} threshold={s.T} duration={duration} atThreshold={noticed} />
          </View>
          <View style={styles.right}>
            <CountdownRing remaining={seg.durationSec - s.segmentElapsedSec} total={seg.durationSec} />
            <Text style={styles.reps}>
              {Math.floor(s.repsThisSegment)}
              <Text style={styles.repsTotal}>{` / ${seg.targetReps}`}</Text>
            </Text>
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
  stage: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  left: {width: '58%', gap: px(56)},
  exercise: {flexDirection: 'row', alignItems: 'center', gap: px(32)},
  names: {flex: 1},
  name: {...type.display(88), marginTop: px(4)},
  cue: {...type.body(36), marginTop: px(16)},
  right: {flex: 1, alignItems: 'center'},
  reps: {...type.title(72), marginTop: px(48)},
  repsTotal: {color: colors.textDim},
});

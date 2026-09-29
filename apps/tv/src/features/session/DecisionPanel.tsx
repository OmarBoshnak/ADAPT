import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Adaptation} from '@adapt/core';

import {exercise} from '~/exercises/catalog';
import {ExercisePhoto} from '~/exercises/ExercisePhoto';
import {colors, px, radius, type} from '~/theme';
import {Icon} from '~/ui/Icon';

export function DecisionPanel({adaptation, startsIn}: {adaptation: Adaptation; startsIn: number}) {
  const from = exercise(adaptation.fromExerciseId);
  const to = exercise(adaptation.toExerciseId);
  const switching = adaptation.action === 'switch';
  const steps = ['Strain threshold', 'Adapt', switching ? to.name : 'Rest'];

  return (
    <View style={styles.panel}>
      <ExercisePhoto exercise={switching ? to : from} size={180}>
        <View style={styles.badge}>
          <Icon name="trendDown" size={32} color={colors.fieldWarm} />
        </View>
      </ExercisePhoto>
      <View style={styles.text}>
        <Text style={styles.eyebrow}>Adaptive decision</Text>
        <Text style={styles.main}>{switching ? `Switching to ${to.name}` : `Ending ${from.name} early`}</Text>
        <Text style={styles.reason}>{adaptation.reason}</Text>
        <View style={styles.chain}>
          {steps.map((step, i) => (
            <View key={step} style={styles.link}>
              {i > 0 && <Icon name="arrow" size={28} color={colors.textDim} />}
              <Text style={[styles.step, i === 1 && styles.stepActive]}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.countdown}>
        <Text style={type.eyebrow(24)}>Starting in</Text>
        <Text style={type.display(80)}>{Math.max(1, Math.ceil(startsIn))}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: px(126),
    alignSelf: 'center',
    width: px(1240),
    minHeight: px(300),
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(40),
    padding: px(56),
    borderRadius: px(24),
    backgroundColor: colors.surfaceWarm,
    borderWidth: px(2),
    borderColor: colors.amber,
  },
  badge: {
    position: 'absolute',
    left: px(-20),
    bottom: px(-20),
    width: px(72),
    height: px(72),
    borderRadius: radius.pill,
    backgroundColor: colors.amber,
    opacity: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {flex: 1},
  eyebrow: {...type.eyebrow(26), color: colors.amber},
  main: {...type.title(60), marginTop: px(8)},
  reason: {...type.body(32), marginTop: px(8)},
  chain: {flexDirection: 'row', alignItems: 'center', gap: px(12), marginTop: px(20)},
  link: {flexDirection: 'row', alignItems: 'center', gap: px(12)},
  step: type.eyebrow(24, 0.1),
  stepActive: {color: colors.amber},
  countdown: {alignItems: 'center'},
});

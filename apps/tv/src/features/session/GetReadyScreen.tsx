import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Exercise} from '@adapt/core';

import {ExerciseVisual} from '~/exercises/ExerciseVisual';
import {metaLabels} from '~/exercises/catalog';
import {colors, px, radius, type} from '~/theme';
import {Icon} from '~/ui/Icon';
import {MetaPills} from '~/ui/MetaPills';
import {Screen} from '~/ui/Screen';

type Props = {resting: boolean; remaining: number; next: Exercise; paired: boolean};

export function GetReadyScreen({resting, remaining, next, paired}: Props) {
  return (
    <Screen style={styles.center}>
      <Text style={styles.eyebrow}>{resting ? 'Rest' : 'Get ready'}</Text>
      <Text style={styles.count}>{Math.ceil(remaining)}</Text>
      {paired && (
        <View style={styles.reminder}>
          <Icon name="phoneFlat" size={44} />
          <Text style={type.body(34)}>Phone on the floor, screen up</Text>
        </View>
      )}
      <View style={styles.card}>
        <ExerciseVisual exercise={next} size={200} animate />
        <View style={styles.cardText}>
          <Text style={type.eyebrow(26)}>{resting ? 'Up next' : 'First up'}</Text>
          <Text style={styles.name}>{next.name}</Text>
          {next.cue && <Text style={styles.cue}>{next.cue}</Text>}
          <MetaPills labels={metaLabels(next)} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center'},
  eyebrow: {...type.eyebrow(40, 0.16), color: colors.accent},
  count: {...type.display(320), letterSpacing: px(320 * -0.03), lineHeight: px(330), marginTop: px(16)},
  reminder: {flexDirection: 'row', alignItems: 'center', gap: px(20), marginTop: px(40)},
  card: {
    width: px(900),
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(32),
    padding: px(48),
    marginTop: px(56),
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardText: {flex: 1, gap: px(12)},
  name: type.title(64),
  cue: type.body(32),
});

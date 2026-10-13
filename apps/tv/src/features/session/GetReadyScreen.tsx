import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Exercise} from '@adapt/core';

import {ExerciseVisual} from '~/exercises/ExerciseVisual';
import {metaLabels} from '~/exercises/catalog';
import {colors, px, type} from '~/theme';
import {Icon} from '~/ui/Icon';
import {MetaPills} from '~/ui/MetaPills';
import {Screen} from '~/ui/Screen';

type Props = {resting: boolean; remaining: number; next: Exercise; paired: boolean};

export function GetReadyScreen({resting, remaining, next, paired}: Props) {
  return (
    <Screen style={styles.center}>
      <View style={styles.row}>
        <ExerciseVisual exercise={next} size={520} rounded={px(24)} animate />
        <View style={styles.text}>
          <Text style={styles.eyebrow}>{resting ? 'Rest' : 'Get ready'}</Text>
          <Text style={styles.count}>{Math.ceil(remaining)}</Text>
          <Text style={type.eyebrow(26)}>{resting ? 'Up next' : 'First up'}</Text>
          <Text style={styles.name}>{next.name}</Text>
          {next.cue && <Text style={styles.cue}>{next.cue}</Text>}
          <MetaPills labels={metaLabels(next)} />
          {paired && (
            <View style={styles.reminder}>
              <Icon name="phoneFlat" size={44} />
              <Text style={type.body(30)}>Phone on the floor, screen up</Text>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center'},
  row: {flexDirection: 'row', alignItems: 'center', gap: px(80)},
  text: {width: px(760), gap: px(12)},
  eyebrow: {...type.eyebrow(40, 0.16), color: colors.accent},
  count: {...type.display(240), letterSpacing: px(240 * -0.03), lineHeight: px(250)},
  name: type.title(64),
  cue: type.body(32),
  reminder: {flexDirection: 'row', alignItems: 'center', gap: px(20), marginTop: px(24)},
});

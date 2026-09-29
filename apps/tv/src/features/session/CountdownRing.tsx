import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle} from '@amazon-devices/react-native-svg';

import {colors, px, type} from '~/theme';

const SIZE = 400;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function CountdownRing({remaining, total}: {remaining: number; total: number}) {
  const done = total > 0 ? Math.min(1, Math.max(0, (total - remaining) / total)) : 0;

  return (
    <View style={styles.box}>
      <Svg width={px(SIZE)} height={px(SIZE)} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.border} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - done)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.number}>{Math.ceil(remaining)}</Text>
        <Text style={type.eyebrow(26)}>Seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {width: px(SIZE), height: px(SIZE)},
  center: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center'},
  number: {...type.display(168), lineHeight: px(180)},
});

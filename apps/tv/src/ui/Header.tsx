import React, {type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, type} from '~/theme';

export function Header({right}: {right?: ReactNode}) {
  return (
    <View style={styles.row}>
      <Text style={styles.wordmark}>ADAPT</Text>
      {right}
    </View>
  );
}

export function StepDots({total, current}: {total: number; current: number}) {
  return (
    <View style={styles.dots}>
      {Array.from({length: total}, (_, i) => (
        <View key={i} style={[styles.dot, i === current - 1 && styles.dotActive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: px(40)},
  wordmark: type.display(32),
  dots: {flexDirection: 'row', gap: px(16)},
  dot: {width: px(12), height: px(12), borderRadius: px(6), backgroundColor: colors.border},
  dotActive: {backgroundColor: colors.accent},
});

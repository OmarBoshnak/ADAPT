import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, radius, type} from '~/theme';

export function MetaPills({labels}: {labels: string[]}) {
  return (
    <View style={styles.row}>
      {labels.map(label => (
        <View key={label} style={styles.pill}>
          <Text style={styles.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: px(12)},
  pill: {height: px(44), paddingHorizontal: px(24), borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, justifyContent: 'center'},
  label: {...type.label(24), color: colors.textDim},
});

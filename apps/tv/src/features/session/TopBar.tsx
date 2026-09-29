import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, radius, type} from '~/theme';

type Props = {title: string; index: number; count: number; progress: number};

export function TopBar({title, index, count, progress}: Props) {
  return (
    <View>
      <View style={styles.row}>
        <Text style={type.label(32)}>{title}</Text>
        <Text style={type.eyebrow(30)}>{`Exercise ${index + 1} of ${count}`}</Text>
      </View>
      <View style={styles.segments}>
        {Array.from({length: count}, (_, i) => (
          <View key={i} style={styles.segment}>
            <View style={[styles.fill, {width: `${fillFor(i, index, progress) * 100}%`}]} />
          </View>
        ))}
      </View>
    </View>
  );
}

const fillFor = (i: number, index: number, progress: number) => (i < index ? 1 : i === index ? progress : 0);

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  segments: {flexDirection: 'row', gap: px(12), marginTop: px(28)},
  segment: {flex: 1, height: px(6), borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden'},
  fill: {height: '100%', backgroundColor: colors.accent},
});

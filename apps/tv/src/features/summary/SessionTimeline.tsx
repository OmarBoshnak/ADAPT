import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Line, Path} from '@amazon-devices/react-native-svg';
import type {Adaptation, StrainPoint} from '@adapt/core';

import {areaPath, linePath, toX, toY, type Scale} from '~/ui/chart';
import {colors, px, type} from '~/theme';

const WIDTH = 1728;
const HEIGHT = 120;

type Props = {series: StrainPoint[]; threshold: number; adaptations: Adaptation[]};

export function SessionTimeline({series, threshold, adaptations}: Props) {
  const end = series[series.length - 1]?.t ?? 1;
  const sc: Scale = {width: WIDTH, height: HEIGHT, tMax: Math.max(end, 1), sMax: threshold * 1.18};
  const ceiling = toY(threshold, sc);

  return (
    <View>
      <Text style={type.eyebrow(26)}>Strain across the session</Text>
      <View style={styles.labels}>
        {adaptations.map(a => (
          <Text key={a.atSec} style={[styles.adapted, {left: px(toX(a.atSec, sc) + 10)}]}>
            Adapted
          </Text>
        ))}
      </View>
      <Svg width={px(WIDTH)} height={px(HEIGHT)} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <Path d={areaPath(series, sc)} fill={colors.volt} opacity={0.12} />
        <Path d={linePath(series, sc)} stroke={colors.volt} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Line x1={0} y1={ceiling} x2={WIDTH} y2={ceiling} stroke={colors.amber} strokeWidth={2} strokeDasharray="10 8" />
        {adaptations.map(a => (
          <Line key={a.atSec} x1={toX(a.atSec, sc)} y1={0} x2={toX(a.atSec, sc)} y2={HEIGHT} stroke={colors.accent} strokeWidth={1.5} strokeDasharray="6 5" opacity={0.7} />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {height: px(34), marginTop: px(12)},
  adapted: {...type.eyebrow(24, 0.1), position: 'absolute', top: 0},
});

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Path} from '@amazon-devices/react-native-svg';
import {adaptsInLabel} from '@adapt/core';

import {colors, px, type} from '~/theme';
import {areaPath, linePath, toX, toY, untilLimit, type Point, type Scale} from '~/ui/chart';

const HEIGHT = 180;
const HEADROOM = 1.18;

type Props = {
  history: Point[];
  forecast: Point[];
  threshold: number;
  duration: number;
  /** TV-9: the line has reached the ceiling and the forecast is gone. */
  atThreshold?: boolean;
  width?: number;
};

export function StrainCurve({history, forecast, threshold, duration, atThreshold = false, width = 900}: Props) {
  const sc: Scale = {width, height: HEIGHT, tMax: duration, sMax: threshold * HEADROOM};
  const now = history[history.length - 1] ?? {t: 0, s: 0};
  const ahead = atThreshold ? {points: [], crossing: null} : untilLimit([now, ...forecast], threshold);
  const ceilingY = toY(threshold, sc);
  const secondsUntil = ahead.crossing ? ahead.crossing.t - now.t : null;
  const label = adaptsInLabel(secondsUntil);
  const labelX = ahead.crossing ? toX(ahead.crossing.t, sc) : 0;

  return (
    <View>
      <Text style={styles.eyebrow}>Predicted strain</Text>
      <View style={{width: px(width), height: px(HEIGHT)}}>
        <Svg width={px(width)} height={px(HEIGHT)} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <Path d={areaPath(history, sc)} fill={colors.volt} opacity={0.12} />
          <Line x1={0} y1={ceilingY} x2={width} y2={ceilingY} stroke={colors.amber} strokeWidth={2} strokeDasharray="10 8" />
          {ahead.points.length > 1 && (
            <Path d={linePath(ahead.points, sc)} stroke={colors.textDim} strokeWidth={6} strokeDasharray="18 12" strokeLinecap="round" fill="none" />
          )}
          <Path d={linePath(history, sc)} stroke={colors.volt} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {ahead.crossing && (
            <Circle cx={toX(ahead.crossing.t, sc)} cy={ceilingY} r={8} stroke={colors.amber} strokeWidth={2} fill={colors.field} />
          )}
          {atThreshold ? (
            <Circle cx={toX(now.t, sc)} cy={ceilingY} r={10} fill={colors.amber} />
          ) : (
            <Circle cx={toX(now.t, sc)} cy={toY(now.s, sc)} r={10} fill={colors.volt} />
          )}
        </Svg>
        {label && (
          <Text style={[styles.label, labelX > width * 0.72 ? {right: px(width - labelX + 18)} : {left: px(labelX + 18)}]}>
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {...type.eyebrow(26), marginBottom: px(16)},
  label: {...type.eyebrow(24, 0.1), color: colors.amber, position: 'absolute', top: px(-6)},
});

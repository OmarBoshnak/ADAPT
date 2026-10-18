import React, {type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Exercise} from '@adapt/core';

import {colors, px, radius, type} from '~/theme';
import {ExerciseIllustration} from './ExerciseIllustration';
import {illustrations} from './illustrations';

type Props = {exercise: Exercise; size: number; rounded?: number; animate?: boolean; children?: ReactNode};

/** The movement's drawing, or its lettered tile if it has none. */
export function ExerciseVisual({exercise, size, rounded = radius.photo, animate = false, children}: Props) {
  const illustration = illustrations[exercise.id];
  const box = {width: px(size), height: px(size), borderRadius: rounded};

  return (
    <View style={box}>
      <View style={[box, styles.tile]}>
        {illustration ? (
          <ExerciseIllustration illustration={illustration} size={px(size)} animate={animate} />
        ) : (
          <Text style={[type.display(size * 0.4), styles.initial]}>{exercise.name.charAt(0)}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {color: colors.textDim},
});

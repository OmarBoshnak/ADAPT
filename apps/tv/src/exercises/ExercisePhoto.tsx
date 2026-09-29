import React, {type ReactNode} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import type {Exercise} from '@adapt/core';

import {colors, px, radius, type} from '~/theme';
import {photos} from './photos';

type Props = {exercise: Exercise; size: number; rounded?: number; children?: ReactNode};

export function ExercisePhoto({exercise, size, rounded = radius.photo, children}: Props) {
  const source = photos[exercise.id];
  const box = {width: px(size), height: px(size), borderRadius: rounded};

  return (
    <View style={box}>
      {source ? (
        <Image source={source} style={[box, styles.image]} resizeMode="cover" accessible={false} />
      ) : (
        <View style={[box, styles.fallback]}>
          <Text style={[type.display(size * 0.4), styles.initial]}>{exercise.name.charAt(0)}</Text>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {backgroundColor: colors.surfaceRaised},
  fallback: {backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
  initial: {color: colors.textDim},
});

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Exercise} from '@adapt/core';

import {ExercisePhoto} from '~/exercises/ExercisePhoto';
import {metaLabels} from '~/exercises/catalog';
import {colors, px, radius, type} from '~/theme';
import {Button} from '~/ui/Button';
import {Focusable} from '~/ui/Focusable';
import {Header} from '~/ui/Header';
import {Icon} from '~/ui/Icon';
import {MetaPills} from '~/ui/MetaPills';
import {Screen} from '~/ui/Screen';

type Props = {
  current: Exercise;
  easier: Exercise | null;
  different: Exercise | null;
  paired: boolean;
  onEasier: () => void;
  onDifferent: () => void;
  onKeep: () => void;
  onEnd: () => void;
};

export function SwapScreen({current, easier, different, paired, onEasier, onDifferent, onKeep, onEnd}: Props) {
  const dropsJump = !!easier && current.tags.includes('plyometric') && !easier.tags.includes('plyometric');

  return (
    <Screen>
      <Header />
      <Text style={styles.eyebrow}>Currently doing</Text>
      <Text style={styles.current}>{current.name}</Text>
      <View style={styles.cards}>
        {easier && (
          <Card
            exercise={easier}
            reason="If it's too hard"
            reasonColor={colors.amber}
            description={dropsJump ? 'Same movement, without the jump' : 'Same movement, a lighter version'}
            onPress={onEasier}
            preferred
          />
        )}
        {different && (
          <Card
            exercise={different}
            reason="If it doesn't suit you"
            reasonColor={colors.textDim}
            description="Different movement, same muscles worked"
            onPress={onDifferent}
            preferred={!easier}
          />
        )}
      </View>
      <View style={styles.footer}>
        <View style={styles.actions}>
          <Button label="Keep going" variant="secondary" onPress={onKeep} preferred={!easier && !different} />
          <Button label="End session" variant="secondary" onPress={onEnd} />
        </View>
        {paired && (
          <View style={styles.voice}>
            <Icon name="mic" size={26} color={colors.volt} />
            <Text style={[type.body(28), styles.voiceText]}>Or just say 'easier'</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}

type CardProps = {
  exercise: Exercise;
  reason: string;
  reasonColor: string;
  description: string;
  onPress: () => void;
  preferred?: boolean;
};

function Card({exercise, reason, reasonColor, description, onPress, preferred}: CardProps) {
  return (
    <Focusable
      radius={radius.surface}
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      accessibilityRole="button"
      style={styles.card}
      focusedStyle={styles.cardFocused}>
      <ExercisePhoto exercise={exercise} size={180} />
      <Text style={[styles.reason, {color: reasonColor}]}>{reason}</Text>
      <Text style={styles.name}>{exercise.name}</Text>
      <Text style={styles.description}>{description}</Text>
      <MetaPills labels={metaLabels(exercise)} />
    </Focusable>
  );
}

const styles = StyleSheet.create({
  eyebrow: {...type.eyebrow(26), marginTop: px(72)},
  current: {...type.title(64), marginTop: px(12)},
  cards: {flex: 1, flexDirection: 'row', gap: px(40), marginTop: px(64)},
  card: {
    width: px(800),
    height: px(460),
    padding: px(44),
    gap: px(10),
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardFocused: {backgroundColor: colors.accentTint, borderWidth: px(2), borderColor: colors.accent},
  reason: {...type.eyebrow(24), marginTop: px(14)},
  name: type.title(52),
  description: {...type.body(30), marginBottom: px(6)},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  actions: {flexDirection: 'row', gap: px(24)},
  voice: {flexDirection: 'row', alignItems: 'center', gap: px(14)},
  voiceText: {color: colors.textDim},
});

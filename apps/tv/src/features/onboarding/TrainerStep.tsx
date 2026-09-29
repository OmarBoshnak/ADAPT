import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, radius, type} from '~/theme';
import {Button} from '~/ui/Button';
import {Focusable} from '~/ui/Focusable';
import {Avatar} from './Avatar';
import {Footnote, StepLayout} from './StepLayout';
import {TRAINERS} from './trainers';

type Props = {trainerId: string; onSelect: (id: string) => void; onContinue: () => void};

export function TrainerStep({trainerId, onSelect, onContinue}: Props) {
  return (
    <StepLayout
      step={1}
      title="Who's coaching you?"
      subtitle="You can change this later"
      footer={
        <>
          <Footnote>ADAPT does not give medical advice.</Footnote>
          <Button label="Continue" onPress={onContinue} />
        </>
      }>
      <View style={styles.cards}>
        {TRAINERS.map(t => (
          <Focusable
            key={t.id}
            radius={radius.surface}
            onFocus={() => onSelect(t.id)}
            onPress={onContinue}
            hasTVPreferredFocus={t.id === trainerId}
            accessibilityRole="button"
            accessibilityState={{selected: t.id === trainerId}}
            style={[styles.card, t.id === trainerId && styles.cardSelected]}
            focusedStyle={styles.cardFocused}>
            <Avatar trainerId={t.id} size={200} />
            <Text style={styles.name}>{t.name}</Text>
            <Text style={styles.descriptor}>{t.descriptor}</Text>
          </Focusable>
        ))}
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  cards: {flexDirection: 'row', gap: px(40)},
  card: {
    width: px(560),
    height: px(420),
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSelected: {borderWidth: px(2), borderColor: colors.accent},
  cardFocused: {backgroundColor: colors.accentTint, borderWidth: px(2), borderColor: colors.accent},
  name: {...type.title(48), marginTop: px(28)},
  descriptor: {...type.body(28), color: colors.textDim, marginTop: px(8)},
});

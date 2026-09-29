import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {IntensityPreference, Profile} from '@adapt/core';

import {colors, px, type} from '~/theme';
import {Button} from '~/ui/Button';
import {ChoiceRow} from '~/ui/ChoiceRow';
import {StepLayout} from './StepLayout';
import {trainerName} from './trainers';

const LENGTHS = [4, 8, 12, 20, 30];
const INTENSITIES: Array<[IntensityPreference, string]> = [
  ['gentle', 'Gentle'],
  ['steady', 'Steady'],
  ['hard', 'Hard'],
];

type Props = {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
  onBack: () => void;
  onStart: () => void;
};

export function PreferenceStep({profile, onChange, onBack, onStart}: Props) {
  const limitation = [...profile.injuries, ...profile.conditions][0];
  const summary = [
    trainerName(profile.trainerId),
    String(profile.ageYears),
    limitation,
    `${profile.defaultDurationMin} minutes`,
    profile.intensityPreference,
  ].filter(Boolean);

  return (
    <StepLayout
      step={4}
      title="How long, usually?"
      subtitle="You can change this every session"
      footer={
        <>
          <Button label="Back" variant="secondary" onPress={onBack} />
          <Button label="Start my first session" onPress={onStart} preferred />
        </>
      }>
      <ChoiceRow
        label="Session length"
        options={LENGTHS.map(m => [m, `${m} min`])}
        selected={profile.defaultDurationMin}
        onSelect={defaultDurationMin => onChange({defaultDurationMin})}
      />
      <ChoiceRow
        label="Intensity"
        options={INTENSITIES}
        selected={profile.intensityPreference}
        onSelect={intensityPreference => onChange({intensityPreference})}
      />
      <View style={styles.summary}>
        <Text style={styles.summaryText}>{summary.join('  ·  ')}</Text>
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  summary: {marginTop: px(16), alignItems: 'center'},
  summaryText: {...type.body(30), color: colors.textDim},
});

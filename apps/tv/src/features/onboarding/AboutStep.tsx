import React from 'react';
import {StyleSheet, View} from 'react-native';
import type {Profile} from '@adapt/core';

import {px} from '~/theme';
import {Button} from '~/ui/Button';
import {StepperRow} from './StepperRow';
import {Footnote, StepLayout} from './StepLayout';

type Body = Pick<Profile, 'ageYears' | 'heightCm' | 'weightKg'>;
type Props = {value: Body; onChange: (patch: Partial<Body>) => void; onContinue: () => void};

export function AboutStep({value, onChange, onContinue}: Props) {
  return (
    <StepLayout
      step={2}
      title="About you"
      subtitle="This helps choose movements that suit you"
      footer={
        <>
          <Footnote>Used only to select movements. Never shown back as an assessment.</Footnote>
          <Button label="Continue" onPress={onContinue} />
        </>
      }>
      <View style={styles.rows}>
        <StepperRow label="Age" unit="years" min={18} max={90} value={value.ageYears} onChange={ageYears => onChange({ageYears})} preferred />
        <StepperRow label="Height" unit="cm" min={140} max={220} value={value.heightCm} onChange={heightCm => onChange({heightCm})} />
        <StepperRow label="Weight" unit="kg" min={40} max={200} value={value.weightKg} onChange={weightKg => onChange({weightKg})} />
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({rows: {gap: px(40)}});

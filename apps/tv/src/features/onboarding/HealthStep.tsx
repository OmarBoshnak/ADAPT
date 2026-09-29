import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {Condition, Injury} from '@adapt/core';

import {px, type} from '~/theme';
import {Button} from '~/ui/Button';
import {OptionPill} from '~/ui/OptionPill';
import {Footnote, StepLayout} from './StepLayout';

const INJURIES: Array<[Injury, string]> = [
  ['knee', 'Knee'],
  ['lower back', 'Lower back'],
  ['shoulder', 'Shoulder'],
  ['ankle', 'Ankle'],
  ['wrist', 'Wrist'],
  ['neck', 'Neck'],
];

const CONDITIONS: Array<[Condition, string]> = [
  ['high blood pressure', 'High blood pressure'],
  ['asthma', 'Asthma'],
  ['heart condition', 'Heart condition'],
  ['pregnancy', 'Pregnancy'],
  ['joint condition', 'Joint condition'],
];

type Props = {
  injuries: Injury[];
  conditions: Condition[];
  onChange: (patch: {injuries?: Injury[]; conditions?: Condition[]}) => void;
  onContinue: () => void;
};

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

export function HealthStep({injuries, conditions, onChange, onContinue}: Props) {
  return (
    <StepLayout
      compact
      step={3}
      title="Anything we should work around?"
      subtitle="Selected items are excluded from your sessions"
      footer={
        <>
          <Footnote>ADAPT is not a medical service and does not give medical advice. Check with a doctor if you are unsure.</Footnote>
          <Button label="Continue" onPress={onContinue} />
        </>
      }>
      <Group label="Injuries" options={INJURIES} selected={injuries} onChange={next => onChange({injuries: next})} preferred />
      <Group label="Conditions" options={CONDITIONS} selected={conditions} onChange={next => onChange({conditions: next})} />
    </StepLayout>
  );
}

type GroupProps<T> = {
  label: string;
  options: Array<[T, string]>;
  selected: T[];
  onChange: (next: T[]) => void;
  preferred?: boolean;
};

function Group<T>({label, options, selected, onChange, preferred}: GroupProps<T>) {
  return (
    <View style={styles.group}>
      <Text style={styles.eyebrow}>{label}</Text>
      <View style={styles.pills}>
        <OptionPill size="md" checkmark label="None" selected={selected.length === 0} onPress={() => onChange([])} preferred={preferred} />
        {options.map(([value, text]) => (
          <OptionPill key={text} size="md" checkmark label={text} selected={selected.includes(value)} onPress={() => onChange(toggle(selected, value))} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {marginBottom: px(56)},
  eyebrow: {...type.eyebrow(28), marginBottom: px(18)},
  pills: {flexDirection: 'row', flexWrap: 'wrap', gap: px(16)},
});

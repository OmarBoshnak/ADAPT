import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {px, type} from '~/theme';
import {OptionPill} from './OptionPill';

type Props<T> = {
  label: string;
  options: Array<[T, string]>;
  selected: T;
  onSelect: (value: T) => void;
  preferred?: boolean;
};

export function ChoiceRow<T>({label, options, selected, onSelect, preferred}: Props<T>) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        {options.map(([value, text], i) => (
          <OptionPill key={text} label={text} selected={value === selected} onPress={() => onSelect(value)} preferred={preferred && i === 0} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: px(56)},
  label: {...type.eyebrow(28), width: px(420)},
  options: {flexDirection: 'row', gap: px(20)},
});

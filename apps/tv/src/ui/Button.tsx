import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {colors, px, radius, type} from '~/theme';
import {Focusable} from './Focusable';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  preferred?: boolean;
  testID?: string;
};

export function Button({label, onPress, variant = 'primary', preferred, testID}: Props) {
  const primary = variant === 'primary';
  return (
    <Focusable
      radius={radius.pill}
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      testID={testID}
      accessibilityRole="button"
      style={[styles.base, primary ? styles.primary : styles.secondary]}
      focusedStyle={!primary && styles.secondaryFocused}>
      <Text style={primary ? styles.primaryLabel : styles.secondaryLabel}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  base: {alignSelf: 'flex-start', borderRadius: radius.pill, justifyContent: 'center', borderWidth: px(2)},
  primary: {height: px(92), paddingHorizontal: px(56), backgroundColor: colors.accent, borderColor: colors.accent},
  secondary: {height: px(76), paddingHorizontal: px(44), borderColor: colors.border},
  secondaryFocused: {backgroundColor: colors.accentTint, borderColor: colors.accent},
  primaryLabel: {...type.label(34), color: colors.onAccent},
  secondaryLabel: {...type.label(30), color: colors.textSecondary},
});

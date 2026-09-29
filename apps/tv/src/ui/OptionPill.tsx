import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {colors, px, radius, type} from '~/theme';
import {Focusable} from './Focusable';
import {Icon} from './Icon';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'md' | 'lg';
  checkmark?: boolean;
  preferred?: boolean;
};

export function OptionPill({label, selected, onPress, size = 'lg', checkmark, preferred}: Props) {
  const lg = size === 'lg';
  return (
    <Focusable
      radius={radius.pill}
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      accessibilityRole="button"
      accessibilityState={{selected}}
      style={[styles.pill, lg ? styles.lg : styles.md, selected && styles.selected]}
      focusedStyle={styles.focused}>
      {selected && checkmark && <Icon name="check" size={26} color={colors.accent} />}
      <Text style={[type.label(lg ? 34 : 32), selected && styles.selectedLabel]}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(12),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lg: {height: px(92), paddingHorizontal: px(48)},
  md: {height: px(84), paddingHorizontal: px(40)},
  selected: {backgroundColor: colors.accentTint, borderWidth: px(2), borderColor: colors.accent},
  focused: {backgroundColor: colors.accentTint},
  selectedLabel: {color: colors.accent},
});

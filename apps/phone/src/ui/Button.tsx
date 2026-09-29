import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '~/theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'quiet';
  size?: 'large' | 'regular';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', size = 'regular', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles[variant], size === 'large' && styles.large, pressed && styles.pressed, style]}
    >
      <Text style={[styles.label, variant === 'quiet' && styles.quietLabel, size === 'large' && styles.largeLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  quiet: { borderWidth: 1.5, borderColor: colors.border },
  large: { minHeight: 96 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  label: { fontSize: 18, fontWeight: '700', color: colors.text },
  quietLabel: { color: colors.textMuted },
  largeLabel: { fontSize: 30, fontWeight: '800' },
});

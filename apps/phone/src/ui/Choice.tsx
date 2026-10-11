import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, space, type } from '~/theme';

type Props = { label: string; detail?: string; selected: boolean; onPress: () => void };

export function Choice({ label, detail, selected, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={styles.label}>{label}</Text>
      {detail && <Text style={styles.detail}>{detail}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 2,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.petrol },
  label: { fontSize: 17, fontWeight: '700', color: colors.text },
  detail: { ...type.body, fontSize: 14, lineHeight: 19 },
});

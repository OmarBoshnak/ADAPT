import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, space } from '~/theme';

export const CODE_LENGTH = 4;

type Props = { value: string; onChange: (value: string) => void; editable: boolean };

export function CodeInput({ value, onChange, editable }: Props) {
  const input = useRef<TextInput>(null);
  return (
    <Pressable style={styles.row} onPress={() => input.current?.focus()}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <View key={i} style={[styles.cell, i === value.length && editable && styles.cellActive]}>
          <Text style={styles.digit}>{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={input}
        // Uncontrolled: a controlled value can drop digits typed faster than a render.
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        editable={editable}
        autoFocus
        caretHidden
        accessibilityLabel="Pairing code"
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  cell: {
    width: 68,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.petrol,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.accent },
  digit: { fontSize: 44, fontWeight: '800', color: colors.text },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});

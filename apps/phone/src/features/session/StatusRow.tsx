import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '~/theme';

type Props = { tone: 'ok' | 'ask' | 'muted'; text: string };

export function StatusRow({ tone, text }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, styles[tone]]} />
      <Text style={[styles.text, tone === 'ask' && styles.askText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ok: { backgroundColor: colors.volt },
  ask: { backgroundColor: colors.accent },
  muted: { backgroundColor: colors.border },
  text: { ...type.body, flex: 1 },
  askText: { color: colors.text },
});

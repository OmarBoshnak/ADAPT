import { StyleSheet, View } from 'react-native';

import { colors } from '~/theme';

const HEIGHT = 96;

/** The last half-minute of movement signal. Gaps mark moments the floor could not be read. */
export function QualityTrace({ trace, length = 60 }: { trace: Array<number | null>; length?: number }) {
  const empty = Math.max(0, length - trace.length);
  return (
    <View style={styles.row} accessibilityLabel="Movement signal">
      {Array.from({ length: empty }, (_, i) => (
        <View key={`e${i}`} style={styles.bar} />
      ))}
      {trace.map((q, i) => (
        <View key={i} style={[styles.bar, q === null ? styles.gap : [styles.signal, { height: Math.max(3, q * HEIGHT) }]]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
  signal: { backgroundColor: colors.volt, opacity: 0.8 },
  gap: { height: 3, backgroundColor: colors.border },
});

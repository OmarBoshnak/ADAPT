import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '~/theme';

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.floor, paddingHorizontal: space.lg, paddingVertical: space.md },
});

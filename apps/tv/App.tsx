/**
 * Phase 0 smoke test.
 *
 * This is not the product. It exists to prove the platform assumptions the entire
 * build rests on, before a single screen is designed:
 *
 *   1. react-native-tvos reports this as a TV surface (Platform.isTV).
 *   2. D-pad arrow keys actually move focus between elements.
 *   3. A focused element is unmistakable from three metres away.
 *   4. The design spec's 1920x1080 pixel measurements survive the dp conversion.
 *
 * Replaced in Phase 3 by the real screens.
 */

import React, { useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Design-pixel to density-pixel conversion — the single most important utility in
 * the TV app, promoted into theme.ts in Phase 3.
 *
 * The design spec is written against a 1920x1080 canvas, but React Native lays out
 * in dp. This Android TV emulator runs at density 320, so RN sees 960x540 dp — every
 * spec measurement written verbatim would render at exactly double its intended size.
 *
 * Scaling against the real window width instead of hardcoding a divisor means the
 * same code is correct on a 720p Fire TV Stick, a 1080p stick and a 4K Cube alike.
 */
const DESIGN_WIDTH = 1920;
const { width: WINDOW_WIDTH } = Dimensions.get('window');
const px = (n: number) => (n * WINDOW_WIDTH) / DESIGN_WIDTH;

const C = {
  petrol: '#0E2A38',
  surface: '#163542',
  border: '#2A4A5C',
  accent: '#FF6B2C',
  glow: '#FF8A52',
  volt: '#B8FF3C',
  text: '#FFFFFF',
  textSecondary: '#A8C2CE',
  textDim: '#7FA0B0',
};

function FocusProbe({ label }: { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.card, focused && styles.cardFocused]}
    >
      <Text style={[styles.cardLabel, focused && styles.cardLabelFocused]}>{label}</Text>
      <Text style={[styles.cardState, focused && styles.cardStateFocused]}>
        {focused ? 'FOCUSED' : 'idle'}
      </Text>
    </Pressable>
  );
}

export default function App() {
  const { width, height } = Dimensions.get('window');
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>ADAPT · PHASE 0 SMOKE TEST</Text>
      <Text style={styles.heading}>D-pad focus probe</Text>

      <View style={styles.row}>
        <FocusProbe label="One" />
        <FocusProbe label="Two" />
        <FocusProbe label="Three" />
      </View>

      <Text style={styles.readout}>
        Platform.isTV <Text style={styles.readoutValue}>{String(Platform.isTV)}</Text>
        {'     '}window <Text style={styles.readoutValue}>{`${width}x${height} dp`}</Text>
        {'     '}px(96) → <Text style={styles.readoutValue}>{px(96).toFixed(1)} dp</Text>
      </Text>
      <Text style={styles.hint}>
        Press left and right on the remote. Exactly one card reads FOCUSED.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.petrol,
    paddingHorizontal: px(96), // the spec's safe area, in design pixels
    paddingVertical: px(54),
    justifyContent: 'center',
  },
  eyebrow: {
    color: C.textDim,
    fontSize: px(26),
    letterSpacing: px(3),
    fontWeight: '600',
  },
  heading: {
    color: C.text,
    fontSize: px(72),
    fontWeight: '800',
    marginTop: px(12),
    marginBottom: px(64),
  },
  row: { flexDirection: 'row', gap: px(40) },
  card: {
    width: px(500),
    height: px(280),
    borderRadius: px(20),
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFocused: {
    backgroundColor: 'rgba(255,107,44,0.12)',
    borderWidth: px(3),
    borderColor: C.glow,
    transform: [{ scale: 1.04 }],
  },
  cardLabel: { color: C.text, fontSize: px(48), fontWeight: '700' },
  cardLabelFocused: { color: C.accent },
  cardState: {
    color: C.textDim,
    fontSize: px(24),
    marginTop: px(12),
    letterSpacing: px(2),
  },
  cardStateFocused: { color: C.volt, fontWeight: '700' },
  readout: { color: C.textSecondary, fontSize: px(28), marginTop: px(72) },
  readoutValue: { color: C.volt, fontWeight: '700' },
  hint: { color: C.textDim, fontSize: px(26), marginTop: px(16) },
});

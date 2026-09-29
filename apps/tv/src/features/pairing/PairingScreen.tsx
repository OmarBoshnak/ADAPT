import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useRelay} from '~/state/relay';
import {colors, px, radius, type} from '~/theme';
import {Button} from '~/ui/Button';
import {Header} from '~/ui/Header';
import {Icon} from '~/ui/Icon';
import {Screen} from '~/ui/Screen';

const CONTINUE_AFTER_PAIRING_MS = 1200;

export function PairingScreen({onContinue}: {onContinue: () => void}) {
  const {status} = useRelay();
  const paired = status.peer === 'present';
  const digits = (status.code ?? '----').split('');

  useEffect(() => {
    if (!paired) return;
    const timer = setTimeout(onContinue, CONTINUE_AFTER_PAIRING_MS);
    return () => clearTimeout(timer);
  }, [paired, onContinue]);

  const message = paired
    ? 'Phone connected'
    : status.connection === 'open'
      ? 'Waiting for phone'
      : status.attempt > 2
        ? 'Relay unavailable — you can train without a phone'
        : 'Connecting';

  return (
    <Screen>
      <Header />
      <View style={styles.center}>
        <Text style={styles.eyebrow}>Pair your phone</Text>
        <View style={styles.tiles}>
          {digits.map((d, i) => (
            <View key={i} style={styles.tile}>
              <Text style={styles.digit}>{d}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.instruction}>Open ADAPT on your phone and enter this code</Text>
        <View style={styles.hint}>
          <Icon name="phoneFlat" size={40} color={colors.accent} />
          <Text style={styles.hintText}>Then place the phone screen-up on the floor where you'll be training</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <View style={styles.status}>
          <View style={[styles.dot, paired && styles.dotPaired]} />
          <Text style={type.body(30)}>{message}</Text>
        </View>
        <View style={styles.action}>
          <Button label="Continue without phone" variant="secondary" onPress={onContinue} preferred />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  eyebrow: {...type.eyebrow(34), color: colors.textSecondary},
  tiles: {flexDirection: 'row', gap: px(28), marginTop: px(64)},
  tile: {
    width: px(168),
    height: px(216),
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: type.display(132),
  instruction: {...type.body(38), marginTop: px(56)},
  hint: {flexDirection: 'row', alignItems: 'center', gap: px(20), marginTop: px(40)},
  hintText: {...type.body(32), color: colors.textDim},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: px(26)},
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(20),
    height: px(68),
    paddingHorizontal: px(40),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {width: px(14), height: px(14), borderRadius: px(7), backgroundColor: colors.accent},
  dotPaired: {backgroundColor: colors.volt},
  action: {position: 'absolute', right: 0},
});

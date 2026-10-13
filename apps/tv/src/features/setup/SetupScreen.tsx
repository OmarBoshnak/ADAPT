import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {exclusionLabels, learnedLine, type Energy, type Profile} from '@adapt/core';

import {colors, px, type} from '~/theme';
import {Button} from '~/ui/Button';
import {ChoiceRow} from '~/ui/ChoiceRow';
import {Header} from '~/ui/Header';
import {Icon} from '~/ui/Icon';
import {Screen} from '~/ui/Screen';

export type SessionRequest = {minutes: number; energy: Energy};

const MINUTES: Array<[number, string]> = [4, 8, 12, 20].map(m => [m, `${m} min`]);
const ENERGY: Array<[Energy, string]> = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
];

const SETTLE_MS = 600;

type Props = {
  profile: Profile;
  /** Called once the choice has settled, before Generate is pressed. */
  onChoice?: (request: SessionRequest) => void;
  onGenerate: (request: SessionRequest) => void;
};

export function SetupScreen({profile, onChoice, onGenerate}: Props) {
  const [minutes, setMinutes] = useState(nearest(profile.defaultDurationMin));
  const [energy, setEnergy] = useState<Energy>('medium');
  const chose = useRef(onChoice);
  chose.current = onChoice;

  useEffect(() => {
    const timer = setTimeout(() => chose.current?.({minutes, energy}), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [minutes, energy]);
  const exclusions = exclusionLabels(profile);
  const learned = learnedLine(profile.personalBias);

  return (
    <Screen>
      <Header />
      <Text style={styles.title}>Build your session</Text>
      <Text style={styles.subtitle}>Generated fresh, filtered by your impact limits</Text>
      {learned && (
        <View style={styles.learned}>
          <Icon name="trendUp" size={28} color={colors.volt} />
          <Text style={styles.learnedText}>{learned}</Text>
        </View>
      )}
      <View style={styles.rows}>
        <ChoiceRow label="How much time" options={MINUTES} selected={minutes} onSelect={setMinutes} />
        <ChoiceRow label="Energy right now" options={ENERGY} selected={energy} onSelect={setEnergy} />
      </View>
      <View style={styles.footer}>
        <View style={styles.limits}>
          <Icon name="shield" size={24} />
          <Text style={styles.limitsText}>{exclusions.length ? exclusions.join('  ·  ') : 'Nothing excluded'}</Text>
        </View>
        <Button label="Generate workout" onPress={() => onGenerate({minutes, energy})} preferred />
      </View>
    </Screen>
  );
}

const nearest = (m: number) => MINUTES.reduce((best, [v]) => (Math.abs(v - m) < Math.abs(best - m) ? v : best), 12);

const styles = StyleSheet.create({
  title: {...type.display(80), marginTop: px(96)},
  subtitle: {...type.body(34), marginTop: px(14)},
  learned: {flexDirection: 'row', alignItems: 'center', gap: px(12), marginTop: px(24)},
  learnedText: {...type.body(30), color: colors.volt},
  rows: {flex: 1, marginTop: px(80)},
  footer: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  limits: {flexDirection: 'row', alignItems: 'center', gap: px(14), flex: 1},
  limitsText: {...type.body(28), color: colors.textDim},
});

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {Stats} from '~/state/store';
import {colors, px, radius, type} from '~/theme';
import {Button} from '~/ui/Button';
import {Focusable} from '~/ui/Focusable';
import {Header} from '~/ui/Header';
import {Screen} from '~/ui/Screen';

type Props = {stats: Stats; onStart: () => void; onEditProfile: () => void; onSettings: () => void};

export function HomeScreen({stats, onStart, onEditProfile, onSettings}: Props) {
  return (
    <Screen>
      <Header right={<Text style={styles.stats}>{`${stats.sessions} sessions  ·  ${stats.adaptations} adaptations`}</Text>} />
      <View style={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Ready when you are</Text>
          <Text style={styles.title}>Your workout reacts to you</Text>
        </View>
        <View style={styles.options}>
          <Option title="Start a session" subtitle="Built for your body, and it adapts while you train" onPress={onStart} preferred />
          <Option title="Edit my profile" subtitle="Injuries, conditions, and how long you usually train" onPress={onEditProfile} />
        </View>
      </View>
      <Button label="Settings" variant="secondary" onPress={onSettings} />
    </Screen>
  );
}

type OptionProps = {title: string; subtitle: string; onPress: () => void; preferred?: boolean};

function Option({title, subtitle, onPress, preferred}: OptionProps) {
  return (
    <Focusable
      radius={radius.surface}
      onPress={onPress}
      hasTVPreferredFocus={preferred}
      accessibilityRole="button"
      style={styles.option}
      focusedStyle={styles.optionFocused}>
      <Text style={type.title(48)}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  stats: type.eyebrow(26),
  body: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  hero: {width: '55%', paddingRight: px(64)},
  eyebrow: type.eyebrow(30),
  title: {...type.display(96), marginTop: px(20)},
  options: {flex: 1, gap: px(24)},
  option: {
    height: px(200),
    padding: px(40),
    borderRadius: radius.surface,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionFocused: {backgroundColor: colors.surfaceRaised, borderWidth: px(2), borderColor: colors.accent},
  optionSubtitle: {...type.body(28), marginTop: px(8)},
});

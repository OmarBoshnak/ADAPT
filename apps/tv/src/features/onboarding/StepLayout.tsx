import React, {type ReactNode} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, type} from '~/theme';
import {Header, StepDots} from '~/ui/Header';
import {Screen} from '~/ui/Screen';

type Props = {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  compact?: boolean;
};

export const ONBOARDING_STEPS = 4;

export function StepLayout({step, title, subtitle, children, footer, compact}: Props) {
  return (
    <Screen>
      <Header right={<StepDots total={ONBOARDING_STEPS} current={step} />} />
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

export function Footnote({children}: {children: string}) {
  return <Text style={styles.footnote}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {...type.display(76), marginTop: px(88)},
  titleCompact: {...type.display(68), marginTop: px(72)},
  subtitle: {...type.body(32), marginTop: px(14)},
  body: {flex: 1, marginTop: px(72)},
  bodyCompact: {marginTop: px(64)},
  footer: {flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: px(40)},
  footnote: {...type.body(26), color: colors.textDim, maxWidth: px(900)},
});

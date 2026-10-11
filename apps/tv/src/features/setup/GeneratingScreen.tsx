import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';
import {acceptCoachPlan, exclusionLabels, generatePlan, planRequest, type Profile, type SessionPlan} from '@adapt/core';

import {graph} from '~/exercises/catalog';
import {askCoach} from '~/state/coach';
import {colors, px, radius, type} from '~/theme';
import {Screen} from '~/ui/Screen';
import type {SessionRequest} from './SetupScreen';

const MIN_DISPLAY_MS = 3000;
const TRACK = 720;
const SEGMENT = 240;

type Props = {
  profile: Profile;
  request: SessionRequest;
  seed: number;
  /** Off when a filmed plan must be reproducible. */
  useCoach: boolean;
  onReady: (plan: SessionPlan) => void;
};

export function GeneratingScreen({profile, request, seed, useCoach, onReady}: Props) {
  const sweep = useRef(new Animated.Value(0)).current;
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true}),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  useEffect(() => {
    const input = {graph, profile, durationMin: request.minutes, energy: request.energy, seed};
    const local = generatePlan(input);
    const asked = planRequest(input);
    const started = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // The coach's choice is re-checked against the strain model; anything it gets wrong falls back to the local plan.
    (useCoach ? askCoach(asked) : Promise.resolve(null)).then(reply => {
      if (cancelled) return;
      const check = reply ? acceptCoachPlan(input, asked, reply) : null;
      const plan = check?.ok ? check.plan : local;
      timer = setTimeout(() => ready.current(plan), Math.max(0, MIN_DISPLAY_MS - (Date.now() - started)));
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [profile, request, seed, useCoach]);

  const exclusion = exclusionLabels(profile)[0];
  const chips = [`${request.minutes} minutes`, `${capitalize(request.energy)} energy`];
  if (exclusion) chips.push(`No ${exclusion.replace(' excluded', '')}`);
  const translateX = sweep.interpolate({inputRange: [0, 1], outputRange: [-px(SEGMENT), px(TRACK)]});

  return (
    <Screen style={styles.center}>
      <Text style={styles.eyebrow}>Building your session</Text>
      <View style={styles.chips}>
        {chips.map(c => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText}>{c}</Text>
          </View>
        ))}
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.segment, {transform: [{translateX}]}]} />
      </View>
      <Text style={styles.caption}>Choosing movements that suit today</Text>
    </Screen>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center'},
  eyebrow: {...type.eyebrow(34), color: colors.textSecondary},
  chips: {flexDirection: 'row', gap: px(24), marginTop: px(48)},
  chip: {
    height: px(84),
    paddingHorizontal: px(44),
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {...type.label(34), color: colors.text},
  track: {width: px(TRACK), height: px(8), borderRadius: radius.pill, backgroundColor: colors.border, marginTop: px(80), overflow: 'hidden'},
  segment: {width: px(SEGMENT), height: px(8), borderRadius: radius.pill, backgroundColor: colors.accent},
  caption: {...type.body(32), color: colors.textDim, marginTop: px(40)},
});

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {SessionSummary} from '@adapt/core';

import {colors, px, radius, type} from '~/theme';
import {Button} from '~/ui/Button';
import {Icon} from '~/ui/Icon';
import {Screen} from '~/ui/Screen';
import {SessionTimeline} from './SessionTimeline';

type Props = {title: string; summary: SessionSummary; onMore: () => void; onDone: () => void};

export function SummaryScreen({title, summary, onMore, onDone}: Props) {
  const {learning} = summary;

  return (
    <Screen>
      <Text style={styles.eyebrow}>Session complete</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.stats}>
        <Stat label="Duration" value={clock(summary.durationSec)} />
        <Stat label="Total reps" value={String(summary.totalReps)} />
        <Stat label="Adaptations" value={String(summary.adaptations.length)} caption={unique(summary.adaptedExerciseNames).join(', ')} />
      </View>
      <View style={styles.timeline}>
        <SessionTimeline series={summary.strainSeries} threshold={summary.threshold} adaptations={summary.adaptations} />
      </View>
      {learning && (
        <View style={styles.learning}>
          <Icon name="trendUp" size={64} color={colors.volt} />
          <View style={styles.learningText}>
            <Text style={styles.learningEyebrow}>What changed</Text>
            <Text style={styles.learningHeadline}>{learning.headline}</Text>
            <Text style={type.body(30)}>{learning.detail}</Text>
          </View>
        </View>
      )}
      <View style={styles.actions}>
        <Button label="Another 4 minutes" onPress={onMore} preferred />
        <Button label="Done" variant="secondary" onPress={onDone} />
      </View>
    </Screen>
  );
}

function Stat({label, value, caption}: {label: string; value: string; caption?: string}) {
  return (
    <View style={styles.stat}>
      <Text style={type.eyebrow(26)}>{label}</Text>
      <Text style={type.display(88)}>{value}</Text>
      {caption ? <Text style={type.body(28)} numberOfLines={1}>{caption}</Text> : null}
    </View>
  );
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const unique = (names: string[]) => [...new Set(names)];

const styles = StyleSheet.create({
  eyebrow: {...type.eyebrow(32), color: colors.volt},
  title: {...type.display(80), marginTop: px(16)},
  stats: {flexDirection: 'row', gap: px(32), marginTop: px(48)},
  stat: {
    flex: 1,
    height: px(230),
    padding: px(44),
    justifyContent: 'center',
    borderRadius: radius.surface,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeline: {flex: 1, justifyContent: 'center'},
  learning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(32),
    minHeight: px(170),
    padding: px(44),
    marginBottom: px(40),
    borderRadius: radius.surface,
    backgroundColor: colors.surfaceRaised,
    borderWidth: px(2),
    borderColor: colors.volt,
  },
  learningText: {flex: 1},
  learningEyebrow: {...type.eyebrow(24), color: colors.volt},
  learningHeadline: {...type.title(40), marginVertical: px(8)},
  actions: {flexDirection: 'row', gap: px(24)},
});

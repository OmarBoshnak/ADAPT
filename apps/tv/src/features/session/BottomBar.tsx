import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, px, radius, type} from '~/theme';
import {Icon, type IconName} from '~/ui/Icon';

type Props = {upNext: string | null; paired: boolean};

export function BottomBar({upNext, paired}: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {upNext && (
          <>
            <Text style={type.eyebrow(24)}>Up next</Text>
            <Text style={styles.next}>{upNext}</Text>
          </>
        )}
      </View>
      <View style={styles.pill}>
        <Icon name={paired ? 'mic' : 'chevronDown'} size={26} color={colors.volt} />
        <Text style={type.body(28)}>{paired ? "Say 'easier' and it learns" : "Press down for 'easier' and it learns"}</Text>
      </View>
      <View style={[styles.side, styles.hints]}>
        <Hint icon="pause" label="Pause" />
        <Hint icon="skip" label="Skip" />
      </View>
    </View>
  );
}

function Hint({icon, label}: {icon: IconName; label: string}) {
  return (
    <View style={styles.hint}>
      <Icon name={icon} size={28} />
      <Text style={styles.hintLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', alignItems: 'center', minHeight: px(96)},
  side: {flex: 1},
  next: {...type.label(34), marginTop: px(4)},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(14),
    height: px(64),
    paddingHorizontal: px(32),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  hints: {flexDirection: 'row', justifyContent: 'flex-end', gap: px(40)},
  hint: {flexDirection: 'row', alignItems: 'center', gap: px(12)},
  hintLabel: {...type.body(28), color: colors.textDim},
});

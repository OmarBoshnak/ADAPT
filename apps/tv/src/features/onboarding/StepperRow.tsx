import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {TVFocusGuideView} from '@amazon-devices/react-native-kepler';

import {useRemote} from '~/hooks/useRemote';
import {colors, px, radius, type} from '~/theme';
import {Focusable} from '~/ui/Focusable';
import {Icon} from '~/ui/Icon';

type Props = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
  preferred?: boolean;
};

export function StepperRow({label, value, unit, min, max, onChange, preferred}: Props) {
  const [focused, setFocused] = useState(false);

  useRemote(key => {
    if (key === 'left') onChange(Math.max(min, value - 1));
    if (key === 'right') onChange(Math.min(max, value + 1));
  }, focused);

  const chevron = focused ? colors.accent : colors.textDim;

  return (
    <TVFocusGuideView trapFocusLeft trapFocusRight>
      <Focusable
        radius={radius.surface}
        scale={1.02}
        hasTVPreferredFocus={preferred}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${label} ${value} ${unit}`}
        style={styles.row}
        focusedStyle={styles.rowFocused}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.control}>
          <Icon name="chevronLeft" size={40} color={chevron} />
          <View style={styles.value}>
            <Text style={styles.number}>{value}</Text>
            <Text style={styles.unit}>{unit}</Text>
          </View>
          <Icon name="chevronRight" size={40} color={chevron} />
        </View>
      </Focusable>
    </TVFocusGuideView>
  );
}

const styles = StyleSheet.create({
  row: {
    width: px(1100),
    height: px(132),
    borderRadius: radius.surface,
    paddingHorizontal: px(40),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowFocused: {backgroundColor: colors.accentTint, borderWidth: px(2), borderColor: colors.accent},
  label: {...type.label(34), width: px(280)},
  control: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: px(48)},
  value: {flexDirection: 'row', alignItems: 'baseline', gap: px(10), minWidth: px(220), justifyContent: 'center'},
  number: type.display(64),
  unit: {...type.body(32), color: colors.textDim},
});

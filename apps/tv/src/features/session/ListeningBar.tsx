import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from '@amazon-devices/react-native-svg';

import {colors, px, radius, type} from '~/theme';
import {Icon} from '~/ui/Icon';

export function ListeningBar({word, spoken}: {word: string; spoken: boolean}) {
  return (
    <View style={styles.bar}>
      {spoken ? <Listening /> : <Icon name="check" size={56} color={colors.volt} />}
      <Text style={styles.word}>{`“${word}”`}</Text>
      <View style={styles.noted}>
        <Icon name="check" size={28} color={colors.volt} />
        <Text style={styles.notedText}>Noted for next time</Text>
      </View>
    </View>
  );
}

function Listening() {
  return (
    <Svg width={px(80)} height={px(56)} viewBox="0 0 80 56">
      <Path d="M20 8 v18 a7 7 0 0 0 14 0 v-18 a7 7 0 0 0 -14 0" stroke={colors.volt} strokeWidth={2.5} fill="none" />
      <Path d="M14 26 c0 10 26 10 26 0 M27 36 v10" stroke={colors.volt} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {[0.72, 0.45, 0.22].map((opacity, i) => (
        <Path key={opacity} d={`M${48 + i * 9} ${14 - i * 4} q${8 + i * 3} ${14 + i * 4} 0 ${28 + i * 8}`} stroke={colors.volt} strokeWidth={2} strokeLinecap="round" opacity={opacity} fill="none" />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: px(54),
    alignSelf: 'center',
    width: px(900),
    height: px(132),
    flexDirection: 'row',
    alignItems: 'center',
    gap: px(28),
    paddingHorizontal: px(44),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: px(2),
    borderColor: colors.volt,
  },
  word: type.title(48),
  noted: {marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: px(10)},
  notedText: {...type.eyebrow(24), color: colors.volt},
});

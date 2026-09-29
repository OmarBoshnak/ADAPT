import React, {useState, type ReactNode} from 'react';
import {Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';

import {colors, focus} from '~/theme';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  radius: number;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  scale?: number;
  children: ReactNode | ((focused: boolean) => ReactNode);
};

export function Focusable({radius, style, focusedStyle, scale = focus.scale, onFocus, onBlur, children, ...rest}: Props) {
  const [focused, setFocused] = useState(false);
  const outset = focus.gap + focus.ring;

  return (
    <Pressable
      {...rest}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[style, focused && focusedStyle, focused && {transform: [{scale}]}]}>
      {focused && (
        <View
          pointerEvents="none"
          style={[styles.ring, {top: -outset, left: -outset, right: -outset, bottom: -outset, borderRadius: radius + outset}]}
        />
      )}
      {typeof children === 'function' ? children(focused) : children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {position: 'absolute', borderWidth: focus.ring, borderColor: colors.focusRing},
});

import React, {useEffect, useRef, type ReactNode} from 'react';
import {Animated, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';

import {colors, safe} from '~/theme';

type Props = {children?: ReactNode; warm?: boolean; style?: StyleProp<ViewStyle>};

export function Screen({children, warm = false, style}: Props) {
  const heat = useRef(new Animated.Value(warm ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(heat, {toValue: warm ? 1 : 0, duration: 450, useNativeDriver: false}).start();
  }, [warm, heat]);

  const backgroundColor = heat.interpolate({inputRange: [0, 1], outputRange: [colors.field, colors.fieldWarm]});

  return <Animated.View style={[styles.root, {backgroundColor}, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  root: {flex: 1, paddingHorizontal: safe.horizontal, paddingVertical: safe.vertical},
});

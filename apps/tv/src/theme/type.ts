import type {TextStyle} from 'react-native';

import {colors} from './colors';
import {px} from './layout';

const tight = (size: number) => px(size * -0.02);

export const type = {
  display: (size: number): TextStyle => ({
    fontFamily: 'Archivo-ExtraBold',
    fontSize: px(size),
    letterSpacing: tight(size),
    color: colors.text,
  }),
  title: (size: number): TextStyle => ({
    fontFamily: 'Archivo-Bold',
    fontSize: px(size),
    letterSpacing: tight(size),
    color: colors.text,
  }),
  body: (size: number): TextStyle => ({
    fontFamily: 'Inter-Regular',
    fontSize: px(size),
    color: colors.textSecondary,
  }),
  label: (size: number): TextStyle => ({
    fontFamily: 'Inter-SemiBold',
    fontSize: px(size),
    color: colors.textSecondary,
  }),
  eyebrow: (size: number, spacing = 0.12): TextStyle => ({
    fontFamily: 'Inter-SemiBold',
    fontSize: px(size),
    letterSpacing: px(size * spacing),
    textTransform: 'uppercase',
    color: colors.textDim,
  }),
};

import React from 'react';
import Svg, {Circle, Line, Path, Rect} from '@amazon-devices/react-native-svg';

import {colors, px} from '~/theme';

export type IconName =
  | 'mic'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'shield'
  | 'phoneFlat'
  | 'pause'
  | 'skip'
  | 'trendDown'
  | 'trendUp'
  | 'arrow';

type Props = {name: IconName; size: number; color?: string};

export function Icon({name, size, color = colors.textDim}: Props) {
  const s = px(size);
  const stroke = {stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none'};

  switch (name) {
    case 'mic':
      return (
        <Svg width={s} height={s} viewBox="0 0 26 26">
          <Rect x={9} y={2} width={8} height={13} rx={4} strokeWidth={1.5} {...stroke} />
          <Path d="M5 13.5 Q5 21 13 21 Q21 21 21 13.5" strokeWidth={1.5} {...stroke} />
          <Line x1={13} y1={21} x2={13} y2={25} strokeWidth={1.5} {...stroke} />
          <Line x1={10} y1={25} x2={16} y2={25} strokeWidth={1.5} {...stroke} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={s} height={s} viewBox="0 0 26 26">
          <Path d="M5 13.5 L10.5 19 L21 8" strokeWidth={2.5} {...stroke} />
        </Svg>
      );
    case 'chevronLeft':
    case 'chevronRight':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40">
          <Path d={name === 'chevronLeft' ? 'M25 10 L15 20 L25 30' : 'M15 10 L25 20 L15 30'} strokeWidth={2.5} {...stroke} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40">
          <Path d="M10 15 L20 25 L30 15" strokeWidth={2.5} {...stroke} />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={s} height={s} viewBox="0 0 20 20">
          <Path d="M10 2 L17 5.5 V10.5 C17 14.5 13.5 17.2 10 18.5 C6.5 17.2 3 14.5 3 10.5 V5.5 Z" strokeWidth={1.5} {...stroke} />
        </Svg>
      );
    case 'phoneFlat':
      return (
        <Svg width={s} height={s} viewBox="0 0 40 40">
          <Rect x={2} y={10} width={36} height={22} rx={4} strokeWidth={2} {...stroke} />
          <Rect x={8} y={14} width={22} height={14} rx={1.5} strokeWidth={1.5} {...stroke} />
          <Circle cx={5.5} cy={21} r={1.5} fill={color} />
          <Rect x={32} y={19} width={3} height={4} rx={1} fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={s} height={s} viewBox="0 0 28 28">
          <Rect x={6} y={5} width={5} height={18} rx={2} fill={color} />
          <Rect x={17} y={5} width={5} height={18} rx={2} fill={color} />
        </Svg>
      );
    case 'skip':
      return (
        <Svg width={s} height={s} viewBox="0 0 28 28">
          <Path d="M5 5 L18 14 L5 23 Z" fill={color} />
          <Rect x={20} y={5} width={3.5} height={18} rx={1.5} fill={color} />
        </Svg>
      );
    case 'trendDown':
      return (
        <Svg width={s} height={s} viewBox="0 0 32 32">
          <Path d="M3 8 L11 16 L19 12 L29 23 M22 23 L29 23 L29 16" strokeWidth={2.5} {...stroke} />
        </Svg>
      );
    case 'trendUp':
      return (
        <Svg width={s} height={s} viewBox="0 0 64 64">
          <Path d="M4 52 L20 36 L36 42 L60 12 M46 10 L60 12 L58 24" strokeWidth={3.5} {...stroke} />
        </Svg>
      );
    case 'arrow':
      return (
        <Svg width={s} height={s * 0.6} viewBox="0 0 36 20">
          <Path d="M0 10 H32 M24 2 L34 10 L24 18" strokeWidth={1.5} {...stroke} />
        </Svg>
      );
  }
}

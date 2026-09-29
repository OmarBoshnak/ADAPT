import React from 'react';
import Svg, {Circle, ClipPath, Defs, Ellipse, G, Path, Rect} from '@amazon-devices/react-native-svg';

import {colors, px} from '~/theme';

const SHOULDERS = 'M-10 210 Q 0 162 44 148 Q 72 138 100 136 Q 128 138 156 148 Q 200 162 210 210 Z';

export function Avatar({trainerId, size}: {trainerId: string; size: number}) {
  const long = trainerId === 'nadia';
  const skin = long ? colors.skinLight : colors.skinWarm;
  const clip = `clip-${trainerId}`;

  return (
    <Svg width={px(size)} height={px(size)} viewBox="0 0 200 200">
      <Defs>
        <ClipPath id={clip}>
          <Circle cx={100} cy={100} r={100} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Circle cx={100} cy={100} r={100} fill={colors.surface} />
        {long && (
          <Path
            d="M30 70 Q 28 20 100 18 Q 172 20 170 70 Q 172 148 152 196 Q 126 218 100 220 Q 74 218 48 196 Q 28 148 30 70 Z"
            fill={colors.hair}
          />
        )}
        <Path d={SHOULDERS} fill={skin} />
        <Rect x={84} y={112} width={32} height={long ? 30 : 32} rx={8} fill={skin} />
        <Ellipse cx={100} cy={long ? 86 : 88} rx={long ? 46 : 48} ry={long ? 52 : 54} fill={skin} />
        {long ? (
          <Path d="M54 72 Q 54 28 100 26 Q 146 28 146 72 Q 144 46 100 44 Q 56 46 54 72 Z" fill={colors.hair} />
        ) : (
          <>
            <Path d="M52 76 Q 52 26 100 24 Q 148 26 148 76 Q 147 48 100 46 Q 53 48 52 76 Z" fill={colors.hair} />
            <Rect x={52} y={72} width={10} height={26} rx={5} fill={colors.hair} />
            <Rect x={138} y={72} width={10} height={26} rx={5} fill={colors.hair} />
          </>
        )}
      </G>
    </Svg>
  );
}

import React, {useEffect, useState} from 'react';
import Svg, {Path} from '@amazon-devices/react-native-svg';

import {colors} from '~/theme';
import type {Illustration} from './illustrations';

// Played 1-2-3-2 so the loop returns smoothly to where it started.
const ORDER = [0, 1, 2, 1];

type Props = {illustration: Illustration; size: number; animate: boolean};

export function ExerciseIllustration({illustration, size, animate}: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const timer = setInterval(() => setStep(s => (s + 1) % ORDER.length), illustration.frameMs);
    return () => clearInterval(timer);
  }, [animate, illustration.frameMs]);

  const shown = animate ? ORDER[step] : 0;
  // All three paths stay mounted; switching frames only changes opacity, so nothing is re-parsed.
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" accessible={false}>
      {illustration.frames.map((d, i) => (
        <Path key={i} d={d} fill={colors.text} fillRule="evenodd" opacity={i === shown ? 1 : 0} />
      ))}
    </Svg>
  );
}

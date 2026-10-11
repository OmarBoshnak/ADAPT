import { TAKE_SECONDS, type Take } from '@adapt/core';

export const TAKE_OPTIONS: Array<{ take: Take; label: string; summary: string }> = [
  { take: 'steady', label: 'Steady', summary: `${TAKE_SECONDS.steady} s at your normal pace, start to finish` },
  { take: 'fading', label: 'Fading', summary: `${TAKE_SECONDS.fading} s: strong at first, then let it get slower and sloppier` },
  { take: 'pickup', label: 'Pick-up', summary: `${TAKE_SECONDS.pickup} s of movement, picking the phone up once when asked` },
];

const FADE_FROM = 0.4;
const PICKUP_AT = 0.5;
const PICKUP_HOLD_SEC = 3;

/** What the person should be doing this far into the take. */
export function takeCue(take: Take, elapsedSec: number): { text: string; act: boolean } {
  const total = TAKE_SECONDS[take];
  if (take === 'fading' && elapsedSec >= total * FADE_FROM) {
    return { text: 'Now let it fade: slower, softer, sloppier', act: true };
  }
  if (take === 'pickup') {
    const at = total * PICKUP_AT;
    if (elapsedSec >= at && elapsedSec < at + PICKUP_HOLD_SEC) return { text: 'Pick me up now', act: true };
    if (elapsedSec >= at + PICKUP_HOLD_SEC) return { text: 'Put me back down and keep going', act: false };
  }
  return { text: 'Keep moving at your normal pace', act: false };
}

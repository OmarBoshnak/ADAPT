/**
 * Every sentence the engine hands to a screen.
 *
 * Kept in one place, inside the copy audit's scope, because the spec's language rules are
 * accuracy requirements rather than style: an adaptation reason is never a measurement, a
 * score or a verdict on the user, and nothing here ever interprets a body or a condition.
 */

import type { LearningOutcome } from './types.js';

const SMALL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];

/** 8 → "eight". The spec writes durations in words ("You're eight minutes in"). */
export function numberToWords(n: number): string {
  const k = Math.round(n);
  if (k < 0) return String(k);
  if (k < SMALL.length) return SMALL[k] as string;
  if (k < 70) {
    const tens = TENS[Math.floor(k / 10)] as string;
    const ones = k % 10;
    return ones === 0 ? tens : `${tens}-${SMALL[ones] as string}`;
  }
  return String(k);
}

function minutesPhrase(minutes: number): string {
  const m = Math.round(minutes);
  return m === 1 ? 'one minute' : `${numberToWords(m)} minutes`;
}

// ---------------------------------------------------------------------------
// Adaptation reasons (TV-9 support line)
// ---------------------------------------------------------------------------

export interface ReasonContext {
  trigger: 'predicted-strain' | 'user-correction';
  action: 'switch' | 'end-segment';
  sessionElapsedSec: number;
  /** Smoothed movement quality, or null when no floor sensor is contributing. */
  quality: number | null;
}

/** Below this, the reason names movement quality rather than accumulated load. */
const QUALITY_REASON_CEILING = 0.75;

export function adaptationReason(ctx: ReasonContext): string {
  if (ctx.trigger === 'user-correction') {
    return 'You asked — and I’ve noted it for next time.';
  }
  if (ctx.action === 'end-segment') {
    return 'Ending this one early — you’ve done the work.';
  }
  if (ctx.quality !== null && ctx.quality < QUALITY_REASON_CEILING) {
    return 'Movement quality dropped across the last few reps.';
  }
  const minutes = ctx.sessionElapsedSec / 60;
  if (minutes >= 2) {
    return `You’re ${minutesPhrase(minutes)} in and this one’s expensive.`;
  }
  return 'This one’s costing more than the plan allowed for.';
}

// ---------------------------------------------------------------------------
// Learning card (TV-10)
// ---------------------------------------------------------------------------

export interface LearningCopy {
  headline: string;
  detail: string;
}

/**
 * The TV-10 learning card. Returns null when nothing was learned, because the spec is
 * explicit that the card appears only after a real correction — never as encouragement.
 */
export function learningCopy(outcome: LearningOutcome | null): LearningCopy | null {
  if (!outcome) return null;

  if (outcome.direction === 'harder') {
    return {
      headline: 'You asked for more before I offered it',
      detail: 'Next session starts a little stronger and holds on longer',
    };
  }

  const earlyMin = outcome.earlySec / 60;
  const headline =
    earlyMin >= 0.75
      ? `You asked for easier ${minutesPhrase(earlyMin)} before I expected it`
      : 'You asked for easier a little before I expected it';

  return { headline, detail: 'Next session starts lighter and adapts sooner' };
}

/** "ADAPTS IN ~2 MIN" on TV-7. Null when no adaptation is expected this session. */
export function adaptsInLabel(secondsUntil: number | null): string | null {
  if (secondsUntil === null) return null;
  if (secondsUntil < 60) return 'ADAPTS IN <1 MIN';
  return `ADAPTS IN ~${Math.round(secondsUntil / 60)} MIN`;
}

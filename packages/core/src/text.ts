// Every sentence the engine hands to a screen, kept inside the copy audit's scope.

import type { LearningOutcome } from './types.js';

const SMALL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'];

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

export interface ReasonContext {
  trigger: 'predicted-strain' | 'user-correction';
  action: 'switch' | 'end-segment';
  sessionElapsedSec: number;
  quality: number | null;
}

const QUALITY_REASON_CEILING = 0.75;

export function adaptationReason(ctx: ReasonContext): string {
  if (ctx.trigger === 'user-correction') {
    return 'You asked — and I’ve noted it for next time.';
  }
  if (ctx.action === 'end-segment') {
    return 'Ending this one early — you’ve done the work.';
  }
  if (ctx.quality !== null && ctx.quality < QUALITY_REASON_CEILING) {
    return 'Your steps on the floor have eased off since this one started.';
  }
  const minutes = ctx.sessionElapsedSec / 60;
  if (minutes >= 2) {
    return `You’re ${minutesPhrase(minutes)} in and this one’s expensive.`;
  }
  return 'This one’s costing more than the plan allowed for.';
}

export interface LearningCopy {
  headline: string;
  detail: string;
}

/** Null unless a real correction taught the model something. */
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

export function adaptsInLabel(secondsUntil: number | null): string | null {
  if (secondsUntil === null) return null;
  if (secondsUntil < 60) return 'ADAPTS IN <1 MIN';
  return `ADAPTS IN ~${Math.round(secondsUntil / 60)} MIN`;
}


const LEARNED_EPSILON = 0.01;

/** Shown before a session once corrections have moved the model; null while it is still on its first guess. */
export function learnedLine(personalBias: number): string | null {
  if (Math.abs(personalBias - 1) < LEARNED_EPSILON) return null;
  return personalBias < 1
    ? 'Tuned from your last session: starts lighter, adapts sooner'
    : 'Tuned from your last session: starts a little stronger';
}

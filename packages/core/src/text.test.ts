import { describe, expect, it } from 'vitest';

import { adaptationReason, adaptsInLabel, learnedLine, learningCopy, numberToWords } from './text.js';
import type { LearningOutcome } from './types.js';

describe('numberToWords', () => {
  it('writes minutes the way the spec does', () => {
    expect(numberToWords(1)).toBe('one');
    expect(numberToWords(8)).toBe('eight');
    expect(numberToWords(20)).toBe('twenty');
    expect(numberToWords(21)).toBe('twenty-one');
    expect(numberToWords(30)).toBe('thirty');
    expect(numberToWords(120)).toBe('120');
    expect(numberToWords(-2)).toBe('-2');
  });
});

describe('adaptationReason', () => {
  const base = { trigger: 'predicted-strain' as const, action: 'switch' as const, sessionElapsedSec: 480, quality: null };

  it('names accumulated load, in the spec’s voice', () => {
    expect(adaptationReason(base)).toBe('You’re eight minutes in and this one’s expensive.');
  });

  it('names movement quality when it is what dropped', () => {
    expect(adaptationReason({ ...base, quality: 0.5 })).toMatch(/Movement quality dropped/);
  });

  it('says something sensible very early in a session', () => {
    expect(adaptationReason({ ...base, sessionElapsedSec: 40 })).toMatch(/costing more/);
  });

  it('says so when the ladder has run out', () => {
    expect(adaptationReason({ ...base, action: 'end-segment' })).toMatch(/Ending this one early/);
  });

  it('frames a spoken correction as teaching, not as a button', () => {
    expect(adaptationReason({ ...base, trigger: 'user-correction' })).toMatch(/noted it for next time/);
  });

  it('never states a measurement, a score, or a verdict', () => {
    const all = [
      adaptationReason(base),
      adaptationReason({ ...base, quality: 0.3 }),
      adaptationReason({ ...base, sessionElapsedSec: 10 }),
      adaptationReason({ ...base, action: 'end-segment' }),
      adaptationReason({ ...base, trigger: 'user-correction' }),
    ];
    for (const r of all) {
      expect(r).not.toMatch(/\d|%|score|threshold|strain|error|warning|fail|bad|poor/i);
    }
  });
});

describe('learningCopy', () => {
  const outcome = (p: Partial<LearningOutcome>): LearningOutcome => ({
    direction: 'easier',
    atSec: 300,
    predictedAtSec: 480,
    earlySec: 180,
    biasBefore: 1,
    biasAfter: 0.85,
    ...p,
  });

  it('does not appear without a real correction', () => {
    expect(learningCopy(null)).toBeNull();
  });

  it('states specifically what was learned', () => {
    const c = learningCopy(outcome({ earlySec: 180 }));
    expect(c?.headline).toBe('You asked for easier three minutes before I expected it');
    expect(c?.detail).toBe('Next session starts lighter and adapts sooner');
  });

  it('uses the singular for one minute and softens under a minute', () => {
    expect(learningCopy(outcome({ earlySec: 65 }))?.headline).toMatch(/one minute before/);
    expect(learningCopy(outcome({ earlySec: 20 }))?.headline).toMatch(/a little before/);
  });

  it('handles "harder"', () => {
    expect(learningCopy(outcome({ direction: 'harder', earlySec: 0 }))?.headline).toMatch(/more/);
  });
});

describe('adaptsInLabel', () => {
  it('rounds to minutes for TV-7', () => {
    expect(adaptsInLabel(130)).toBe('ADAPTS IN ~2 MIN');
    expect(adaptsInLabel(45)).toBe('ADAPTS IN <1 MIN');
    expect(adaptsInLabel(null)).toBeNull();
  });
});

describe('learnedLine', () => {
  it('stays quiet until a correction has moved the model', () => {
    expect(learnedLine(1)).toBeNull();
    expect(learnedLine(1.004)).toBeNull();
    expect(learnedLine(0.88)).toBe('Tuned from your last session: starts lighter, adapts sooner');
    expect(learnedLine(1.05)).toBe('Tuned from your last session: starts a little stronger');
  });
});

import { describe, expect, it } from 'vitest';

import { matchCommand } from './vocabulary.js';

describe('matchCommand', () => {
  it('hears each of the four commands and reports the canonical phrase', () => {
    expect(matchCommand('easier')).toEqual({ command: 'easier', heard: 'easier' });
    expect(matchCommand('Harder!')).toEqual({ command: 'harder', heard: 'harder' });
    expect(matchCommand('swap this')).toEqual({ command: 'swap', heard: 'swap this' });
    expect(matchCommand('Pause')).toEqual({ command: 'pause', heard: 'pause' });
  });

  it('tolerates a near miss from the recogniser', () => {
    expect(matchCommand('easer')?.command).toBe('easier');
    expect(matchCommand('swop this')?.command).toBe('swap');
    expect(matchCommand('paws')?.command).toBe('pause');
  });

  it('finds the word at the end of a running transcript', () => {
    expect(matchCommand('okay this is getting hard easier')?.command).toBe('easier');
  });

  it('ignores words that only sound a little alike', () => {
    for (const phrase of ['easy', 'busier', 'hard', 'louder', 'stop this', 'pose', 'jumping jacks', '']) {
      expect(matchCommand(phrase)).toBeNull();
    }
  });

  it('rejects a result the recogniser itself doubts, but not one without a score', () => {
    expect(matchCommand('easier', 0.1)).toBeNull();
    expect(matchCommand('easier', 0)).not.toBeNull();
    expect(matchCommand('easier', -1)).not.toBeNull();
    expect(matchCommand('easier', 0.9)).not.toBeNull();
  });
});

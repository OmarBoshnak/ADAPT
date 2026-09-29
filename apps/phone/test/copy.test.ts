import { phaseCopy, rejectionCopy } from '~/features/session/copy';
import { jumpingJacks, snapshot, status } from './fixtures';

describe('phaseCopy', () => {
  it('names the movement being measured', () => {
    expect(phaseCopy(status(), snapshot({ phase: 'active', exercise: jumpingJacks })).title).toBe('Jumping Jacks');
  });

  it('shows what the TV switched to', () => {
    const copy = phaseCopy(status(), snapshot({ phase: 'adapting', adapted: { from: 'Jumping Jacks', to: 'Step Jacks' } }));
    expect(copy).toMatchObject({ eyebrow: 'Switching', title: 'Step Jacks' });
  });

  it('waits for the TV before anything else', () => {
    expect(phaseCopy(status({ peer: 'lost' }), snapshot({ phase: 'active' })).title).toBe('Waiting for the TV');
  });

  it('only calls the relay unreachable after a retry', () => {
    expect(phaseCopy(status({ connection: 'connecting' }), snapshot()).title).toBe('Finding your TV…');
    expect(phaseCopy(status({ connection: 'reconnecting', attempt: 2 }), snapshot()).title).toBe('Can’t reach the relay');
  });
});

describe('rejectionCopy', () => {
  it('explains a code no TV is showing', () => {
    expect(rejectionCopy('unknown-code')).toMatch(/No TV is showing that code/);
  });

  it('falls back to a plain sentence', () => {
    expect(rejectionCopy(null)).toMatch(/Try the code again/);
  });
});

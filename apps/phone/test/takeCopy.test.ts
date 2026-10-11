import { takeCue } from '~/features/record/takeCopy';

describe('takeCue', () => {
  it('keeps a steady take steady', () => {
    expect(takeCue('steady', 40)).toEqual({ text: 'Keep moving at your normal pace', act: false });
  });

  it('asks for the fade after the baseline has been captured', () => {
    expect(takeCue('fading', 20).act).toBe(false);
    expect(takeCue('fading', 40)).toEqual({ text: 'Now let it fade: slower, softer, sloppier', act: true });
  });

  it('asks for one pick-up in the middle, then to put it back', () => {
    expect(takeCue('pickup', 10).act).toBe(false);
    expect(takeCue('pickup', 16)).toEqual({ text: 'Pick me up now', act: true });
    expect(takeCue('pickup', 20).text).toBe('Put me back down and keep going');
  });
});

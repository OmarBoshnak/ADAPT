import React from 'react';
import {render} from '@testing-library/react-native';
import {projectionFor} from '@adapt/core';

import {ActiveScreen} from '~/features/session/ActiveScreen';
import {session, snapshot} from './fixtures';

function renderAt(s: ReturnType<typeof session>, mode: 'solo' | 'paired' = 'solo') {
  return render(<ActiveScreen snapshot={snapshot(s.state, mode)} projection={projectionFor(s.ctx, s.state)} />);
}

describe('ActiveScreen', () => {
  it('shows the running exercise, the strain forecast and the countdown', () => {
    const s = session();
    s.tickUntil(st => st.phase === 'active');
    const screen = renderAt(s);
    expect(screen.getByText('Current exercise')).toBeTruthy();
    expect(screen.getByText('Predicted strain')).toBeTruthy();
    expect(screen.getByText('Seconds')).toBeTruthy();
    expect(screen.queryByText('Adaptive decision')).toBeNull();
  });

  it('invites a spoken correction only when a phone can hear it', () => {
    const s = session();
    s.tickUntil(st => st.phase === 'active');
    expect(renderAt(s, 'paired').getByText("Say 'easier' and it learns")).toBeTruthy();
    expect(renderAt(s, 'solo').getByText("Press down for 'easier' and it learns")).toBeTruthy();
  });

  it('renders "I noticed" as the warm decision panel', () => {
    const s = session({personalBias: 0.6});
    s.tickUntil(st => st.phase === 'adapting');
    expect(s.state.pending?.trigger).toBe('predicted-strain');
    const screen = renderAt(s);
    expect(screen.getByText('Adaptive decision')).toBeTruthy();
    expect(screen.getByText(/^Switching to |^Ending /)).toBeTruthy();
    expect(screen.queryByText('Noted for next time')).toBeNull();
  });

  it('renders "I learned" as the listening bar, never the warm panel', () => {
    const s = session();
    s.tickUntil(st => st.phase === 'active');
    s.send({type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier'});
    const screen = renderAt(s, 'paired');
    expect(screen.getByText('“easier”')).toBeTruthy();
    expect(screen.getByText('Noted for next time')).toBeTruthy();
    expect(screen.queryByText('Adaptive decision')).toBeNull();
  });
});

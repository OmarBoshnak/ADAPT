import React from 'react';
import {act, render} from '@testing-library/react-native';
import {generatePlan, narrativeRequest, summaryFor, type SessionPlan} from '@adapt/core';

import {graph} from '~/exercises/catalog';
import {GeneratingScreen} from '~/features/setup/GeneratingScreen';
import {SummaryScreen} from '~/features/summary/SummaryScreen';
import {askCoach} from '~/state/coach';
import {profile, session} from './fixtures';

jest.mock('~/state/coach', () => ({askCoach: jest.fn(), askCoachEarly: jest.fn()}));
const ask = askCoach as jest.MockedFunction<typeof askCoach>;

const request = {minutes: 12, energy: 'medium' as const};
const reference = () =>
  generatePlan({graph, profile: profile(), durationMin: 12, energy: 'medium', seed: 5}).segments.map(s => s.exerciseId);

async function generate(): Promise<SessionPlan> {
  const onReady = jest.fn();
  render(<GeneratingScreen profile={profile()} request={request} seed={5} useCoach onReady={onReady} />);
  await act(async () => {
    await Promise.resolve();
    jest.advanceTimersByTime(3000);
  });
  expect(onReady).toHaveBeenCalledTimes(1);
  return onReady.mock.calls[0][0];
}

describe('GeneratingScreen with the coach', () => {
  it('uses the coach’s plan once it passes the strain model', async () => {
    ask.mockResolvedValue({exerciseIds: reference(), title: 'Living Room Reset', rationale: 'r'});
    const plan = await generate();
    expect(plan.generatedLocally).toBe(false);
    expect(plan.title).toBe('Living Room Reset');
  });

  it('does not ask the coach when a filmed plan must be reproducible', async () => {
    ask.mockClear();
    const onReady = jest.fn();
    render(<GeneratingScreen profile={profile()} request={request} seed={5} useCoach={false} onReady={onReady} />);
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(3000);
    });
    expect(ask).not.toHaveBeenCalled();
    expect(onReady.mock.calls[0][0].generatedLocally).toBe(true);
  });

  it('plans locally when the coach is silent', async () => {
    ask.mockResolvedValue(null);
    const plan = await generate();
    expect(plan.generatedLocally).toBe(true);
  });

  it('plans locally when the coach chooses something it was not offered', async () => {
    ask.mockResolvedValue({exerciseIds: ['Burpees', ...reference().slice(1)], title: 'x', rationale: 'r'});
    const plan = await generate();
    expect(plan.generatedLocally).toBe(true);
  });
});

describe('SummaryScreen with the coach', () => {
  function corrected() {
    const s = session();
    s.tickUntil(st => st.phase === 'active' && st.segmentIndex === 1);
    s.send({type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier'});
    s.tickUntil(st => st.phase === 'complete');
    return s;
  }

  async function show(line: string) {
    ask.mockResolvedValue({line});
    const s = corrected();
    const screen = render(
      <SummaryScreen
        title="t"
        summary={summaryFor(s.ctx, s.state)}
        narrative={narrativeRequest(s.ctx, s.state)}
        onMore={jest.fn()}
        onDone={jest.fn()}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    return screen;
  }

  it('shows the coach’s sentence on the learning card', async () => {
    const screen = await show('Next time I’ll start you lighter and step in sooner.');
    expect(screen.getByText('Next time I’ll start you lighter and step in sooner.')).toBeTruthy();
  });

  it('keeps the built-in sentence when the coach’s breaks the copy rules', async () => {
    const screen = await show('Your weak knees slowed you down.');
    expect(screen.queryByText(/knees/)).toBeNull();
    expect(screen.getByText('Next session starts lighter and adapts sooner')).toBeTruthy();
  });
});

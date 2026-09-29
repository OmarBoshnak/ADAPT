import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {summaryFor} from '@adapt/core';

import {exercise} from '~/exercises/catalog';
import {HealthStep} from '~/features/onboarding/HealthStep';
import {SwapScreen} from '~/features/session/SwapScreen';
import {SetupScreen} from '~/features/setup/SetupScreen';
import {SummaryScreen} from '~/features/summary/SummaryScreen';
import {profile, session} from './fixtures';

describe('SetupScreen', () => {
  it('states what the profile excludes, in plain words', () => {
    const screen = render(<SetupScreen profile={profile({injuries: ['knee']})} onGenerate={jest.fn()} />);
    expect(screen.getByText(/jumping movements excluded/)).toBeTruthy();
  });

  it('says so when nothing is excluded', () => {
    expect(render(<SetupScreen profile={profile()} onGenerate={jest.fn()} />).getByText('Nothing excluded')).toBeTruthy();
  });

  it('generates with the chosen time and energy', () => {
    const onGenerate = jest.fn();
    const screen = render(<SetupScreen profile={profile()} onGenerate={onGenerate} />);
    fireEvent.press(screen.getByText('4 min'));
    fireEvent.press(screen.getByText('High'));
    fireEvent.press(screen.getByText('Generate workout'));
    expect(onGenerate).toHaveBeenCalledWith({minutes: 4, energy: 'high'});
  });
});

describe('HealthStep', () => {
  it('treats "None" as an empty list and clears it', () => {
    const onChange = jest.fn();
    const screen = render(<HealthStep injuries={['knee']} conditions={[]} onChange={onChange} onContinue={jest.fn()} />);
    fireEvent.press(screen.getAllByText('None')[0]!);
    expect(onChange).toHaveBeenCalledWith({injuries: []});
  });

  it('never asks about severity or symptoms', () => {
    const screen = render(<HealthStep injuries={[]} conditions={[]} onChange={jest.fn()} onContinue={jest.fn()} />);
    expect(screen.queryByText(/severity|symptom|how bad|pain/i)).toBeNull();
  });
});

describe('SwapScreen', () => {
  const current = exercise('adapt_jumping_jacks');
  const easier = exercise('adapt_step_jacks');
  const different = exercise('adapt_standing_march');
  const handlers = {onEasier: jest.fn(), onDifferent: jest.fn(), onKeep: jest.fn(), onEnd: jest.fn()};

  it('labels alternatives by reason, never by rank', () => {
    const screen = render(<SwapScreen current={current} easier={easier} different={different} paired={false} {...handlers} />);
    expect(screen.getByText("If it's too hard")).toBeTruthy();
    expect(screen.getByText("If it doesn't suit you")).toBeTruthy();
    expect(screen.getByText('Same movement, without the jump')).toBeTruthy();
    expect(screen.queryByText(/level 1|level 2|easiest|beginner option/i)).toBeNull();
  });

  it('omits an alternative this person has excluded', () => {
    const screen = render(<SwapScreen current={current} easier={null} different={different} paired={false} {...handlers} />);
    expect(screen.queryByText("If it's too hard")).toBeNull();
  });
});

describe('SummaryScreen', () => {
  it('shows the learning card only after a real correction', () => {
    const quiet = session();
    quiet.tickUntil(s => s.phase === 'complete');
    const without = render(<SummaryScreen title="t" summary={summaryFor(quiet.ctx, quiet.state)} onMore={jest.fn()} onDone={jest.fn()} />);
    expect(without.queryByText('What changed')).toBeNull();

    const spoke = session();
    spoke.tickUntil(s => s.phase === 'active' && s.segmentIndex === 1);
    spoke.send({type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier'});
    spoke.tickUntil(s => s.phase === 'complete');
    const withCard = render(<SummaryScreen title="t" summary={summaryFor(spoke.ctx, spoke.state)} onMore={jest.fn()} onDone={jest.fn()} />);
    expect(withCard.getByText('What changed')).toBeTruthy();
    expect(withCard.getByText(/You asked for easier/)).toBeTruthy();
  });
});

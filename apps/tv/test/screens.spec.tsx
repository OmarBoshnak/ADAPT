import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {summaryFor} from '@adapt/core';
import {Path} from '@amazon-devices/react-native-svg';

import {exercise} from '~/exercises/catalog';
import {ExerciseVisual} from '~/exercises/ExerciseVisual';
import {illustrations} from '~/exercises/illustrations';
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

  it('says when the model has learned from a correction, and only then', () => {
    expect(render(<SetupScreen profile={profile()} onGenerate={jest.fn()} />).queryByText(/Tuned from/)).toBeNull();
    const learned = render(<SetupScreen profile={profile({personalBias: 0.88})} onGenerate={jest.fn()} />);
    expect(learned.getByText('Tuned from your last session: starts lighter, adapts sooner')).toBeTruthy();
  });

  it('generates with the chosen time and energy', () => {
    const onGenerate = jest.fn();
    const screen = render(<SetupScreen profile={profile()} onGenerate={onGenerate} />);
    fireEvent.press(screen.getByText('4 min'));
    fireEvent.press(screen.getByText('High'));
    fireEvent.press(screen.getByText('Generate workout'));
    expect(onGenerate).toHaveBeenCalledWith({minutes: 4, energy: 'high'});
  });

  it('reports the choice once it settles, before Generate', () => {
    const onChoice = jest.fn();
    const screen = render(<SetupScreen profile={profile()} onChoice={onChoice} onGenerate={jest.fn()} />);
    fireEvent.press(screen.getByText('4 min'));
    fireEvent.press(screen.getByText('High'));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onChoice).toHaveBeenCalledTimes(1);
    expect(onChoice).toHaveBeenCalledWith({minutes: 4, energy: 'high'});
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
    const without = render(<SummaryScreen title="t" summary={summaryFor(quiet.ctx, quiet.state)} narrative={null} onMore={jest.fn()} onDone={jest.fn()} />);
    expect(without.queryByText('What changed')).toBeNull();

    const spoke = session();
    spoke.tickUntil(s => s.phase === 'active' && s.segmentIndex === 1);
    spoke.send({type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier'});
    spoke.tickUntil(s => s.phase === 'complete');
    const withCard = render(<SummaryScreen title="t" summary={summaryFor(spoke.ctx, spoke.state)} narrative={null} onMore={jest.fn()} onDone={jest.fn()} />);
    expect(withCard.getByText('What changed')).toBeTruthy();
    expect(withCard.getByText(/You asked for easier/)).toBeTruthy();
  });
});

describe('ExerciseVisual', () => {
  const opacities = (screen: ReturnType<typeof render>) => screen.UNSAFE_getAllByType(Path).map(p => p.props.opacity);

  it('shows a lettered tile when a movement has no licensed drawing', () => {
    const screen = render(<ExerciseVisual exercise={exercise('adapt_step_jacks')} size={240} />);
    expect(screen.getByText('S')).toBeTruthy();
  });

  it('draws the movement instead of a tile when it has a drawing', () => {
    const screen = render(<ExerciseVisual exercise={exercise('adapt_jumping_jacks')} size={240} />);
    expect(screen.queryByText('J')).toBeNull();
    expect(opacities(screen)).toEqual([1, 0, 0]);
  });

  it('loops the frames 1-2-3-2 while animating, and holds the first frame otherwise', () => {
    const {frameMs} = illustrations.adapt_jumping_jacks!;
    const screen = render(<ExerciseVisual exercise={exercise('adapt_jumping_jacks')} size={240} animate />);
    const seen = [opacities(screen).indexOf(1)];
    for (let i = 0; i < 4; i++) {
      act(() => {
        jest.advanceTimersByTime(frameMs);
      });
      seen.push(opacities(screen).indexOf(1));
    }
    expect(seen).toEqual([0, 1, 2, 1, 0]);
  });

  it('only has drawings for movements the TV can show', () => {
    for (const id of Object.keys(illustrations)) expect(exercise(id).id).toBe(id);
  });
});

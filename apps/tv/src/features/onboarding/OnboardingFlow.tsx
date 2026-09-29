import React, {useState} from 'react';
import type {Profile} from '@adapt/core';

import {AboutStep} from './AboutStep';
import {HealthStep} from './HealthStep';
import {PreferenceStep} from './PreferenceStep';
import {TrainerStep} from './TrainerStep';

type Step = 'trainer' | 'about' | 'health' | 'preference';

type Props = {initial: Profile; startAt?: Step; onDone: (profile: Profile) => void};

export function OnboardingFlow({initial, startAt = 'trainer', onDone}: Props) {
  const [step, setStep] = useState<Step>(startAt);
  const [draft, setDraft] = useState(initial);
  const update = (patch: Partial<Profile>) => setDraft(d => ({...d, ...patch}));

  switch (step) {
    case 'trainer':
      return <TrainerStep trainerId={draft.trainerId} onSelect={trainerId => update({trainerId})} onContinue={() => setStep('about')} />;
    case 'about':
      return <AboutStep value={draft} onChange={update} onContinue={() => setStep('health')} />;
    case 'health':
      return <HealthStep injuries={draft.injuries} conditions={draft.conditions} onChange={update} onContinue={() => setStep('preference')} />;
    case 'preference':
      return <PreferenceStep profile={draft} onChange={update} onBack={() => setStep('health')} onStart={() => onDone(draft)} />;
  }
}

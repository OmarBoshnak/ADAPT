import React, {useState} from 'react';
import {
  narrativeRequest,
  summaryFor,
  type CoachNarrativeRequest,
  type Profile,
  type SessionPlan,
  type SessionState,
  type SessionSummary,
} from '@adapt/core';

import {config} from './config';
import {graph} from './exercises/catalog';
import {HomeScreen} from './features/home/HomeScreen';
import {OnboardingFlow} from './features/onboarding/OnboardingFlow';
import {PairingScreen} from './features/pairing/PairingScreen';
import {SessionFlow} from './features/session/SessionFlow';
import {GeneratingScreen, preparePlan} from './features/setup/GeneratingScreen';
import {SetupScreen, type SessionRequest} from './features/setup/SetupScreen';
import {SummaryScreen} from './features/summary/SummaryScreen';
import {useBack} from './hooks/useBack';
import {RelayProvider, useRelay} from './state/relay';
import {DEFAULT_PROFILE, useStore, type Stored} from './state/store';
import {Screen} from './ui/Screen';

type Route =
  | {name: 'onboarding'; startAt: 'trainer' | 'about'}
  | {name: 'home'}
  | {name: 'pairing'}
  | {name: 'setup'}
  | {name: 'generating'; request: SessionRequest}
  | {name: 'session'; request: SessionRequest; plan: SessionPlan}
  | {
      name: 'summary';
      request: SessionRequest;
      plan: SessionPlan;
      summary: SessionSummary;
      narrative: CoachNarrativeRequest | null;
    };

export function App() {
  return (
    <RelayProvider url={config.relayUrl}>
      <Root />
    </RelayProvider>
  );
}

function Root() {
  const {stored, save} = useStore();
  const {status} = useRelay();
  const [route, setRoute] = useState<Route | null>(null);
  const current: Route = route ?? (stored ? {name: 'home'} : {name: 'onboarding', startAt: 'trainer'});

  useBack(() => {
    if (!stored) return false;
    if (['onboarding', 'pairing', 'setup', 'summary'].includes(current.name)) {
      setRoute({name: 'home'});
      return true;
    }
    return false;
  });

  if (stored === undefined) return <Screen />;

  const profile = stored?.profile ?? DEFAULT_PROFILE;
  const stats = stored?.stats ?? {sessions: 0, adaptations: 0};
  const seed = config.demoSeed ?? stats.sessions + 1;
  const useCoach = config.demoSeed === null;
  const startSession = () => setRoute(status.peer === 'present' ? {name: 'setup'} : {name: 'pairing'});

  const saveProfile = (next: Profile, then: Route) => {
    save({profile: next, stats});
    setRoute(then);
  };

  const complete = (request: SessionRequest, plan: SessionPlan, state: SessionState) => {
    const ctx = {graph, profile, energy: request.energy};
    const next: Stored = {
      profile: {...profile, personalBias: state.bias},
      stats: {sessions: stats.sessions + 1, adaptations: stats.adaptations + state.adaptations.length},
    };
    save(next);
    setRoute({name: 'summary', request, plan, summary: summaryFor(ctx, state), narrative: narrativeRequest(ctx, state)});
  };

  switch (current.name) {
    case 'onboarding':
      return (
        <OnboardingFlow
          initial={profile}
          startAt={current.startAt}
          onDone={next => saveProfile(next, stored ? {name: 'home'} : {name: 'pairing'})}
        />
      );
    case 'home':
      return (
        <HomeScreen
          stats={stats}
          onStart={startSession}
          onEditProfile={() => setRoute({name: 'onboarding', startAt: 'about'})}
          onSettings={() => setRoute({name: 'onboarding', startAt: 'trainer'})}
        />
      );
    case 'pairing':
      return <PairingScreen onContinue={() => setRoute({name: 'setup'})} />;
    case 'setup':
      return (
        <SetupScreen
          profile={profile}
          onChoice={useCoach ? request => preparePlan(profile, request, seed) : undefined}
          onGenerate={request => setRoute({name: 'generating', request})}
        />
      );
    case 'generating':
      return (
        <GeneratingScreen
          profile={profile}
          request={current.request}
          seed={seed}
          useCoach={useCoach}
          onReady={plan => setRoute({name: 'session', request: current.request, plan})}
        />
      );
    case 'session':
      return (
        <SessionFlow
          ctx={{graph, profile, energy: current.request.energy}}
          plan={current.plan}
          onComplete={state => complete(current.request, current.plan, state)}
        />
      );
    case 'summary':
      return (
        <SummaryScreen
          title={current.plan.title}
          summary={current.summary}
          narrative={current.narrative}
          onMore={() => setRoute({name: 'generating', request: {minutes: 4, energy: current.request.energy}})}
          onDone={() => setRoute({name: 'home'})}
        />
      );
  }
}

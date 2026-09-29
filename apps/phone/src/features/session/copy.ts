import type { RelayStatus, SensorSnapshot } from '@adapt/core';

import { relayHost } from '~/config';

export interface PhaseCopy {
  eyebrow: string;
  title: string;
  body?: string;
}

export function phaseCopy(status: RelayStatus, snapshot: SensorSnapshot): PhaseCopy {
  if (status.connection !== 'open') {
    return status.attempt >= 2
      ? {
          eyebrow: 'Not connected',
          title: 'Can’t reach the relay',
          body: `Is it running at ${relayHost}, on the same Wi-Fi as this phone?`,
        }
      : { eyebrow: 'Connecting', title: 'Finding your TV…' };
  }
  if (status.peer !== 'present') {
    return { eyebrow: 'Paired', title: 'Waiting for the TV', body: 'Keep ADAPT open on the TV.' };
  }
  switch (snapshot.phase) {
    case 'getready':
      return { eyebrow: 'Get ready', title: 'First movement coming up' };
    case 'active':
      return { eyebrow: 'Now', title: snapshot.exercise?.name ?? 'Moving' };
    case 'adapting':
      return { eyebrow: 'Switching', title: snapshot.adapted?.to ?? 'Next movement' };
    case 'rest':
      return { eyebrow: 'Rest', title: 'Breathe', body: 'The next movement starts on the TV.' };
    case 'paused':
      return { eyebrow: 'Paused', title: 'Paused on the TV', body: 'Choose on the TV, or resume here.' };
    case 'complete':
      return { eyebrow: 'Done', title: 'Workout complete', body: 'Your summary is on the TV.' };
    default:
      return { eyebrow: 'Paired', title: 'Ready when you are', body: 'Start a workout on the TV.' };
  }
}

const REJECTIONS: Record<string, string> = {
  'unknown-code': 'No TV is showing that code. Check the TV and try again.',
  'role-taken': 'Another phone is already paired with this TV.',
  'too-many-attempts': 'Too many tries. Wait a minute, then try again.',
  version: 'This phone app and the TV app are different versions.',
};

export function rejectionCopy(reason: string | null): string {
  return (reason && REJECTIONS[reason]) ?? 'The TV didn’t accept this phone. Try the code again.';
}

export const VOICE_HINT = {
  listening: 'Say “easier”, “harder”, “swap this” or “pause”',
  denied: 'Voice is off. Allow the microphone and speech recognition in Settings.',
  unavailable: 'Voice isn’t available on this phone. The buttons always work.',
  off: null,
} as const;

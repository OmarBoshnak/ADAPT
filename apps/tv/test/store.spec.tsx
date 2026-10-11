import React, {useEffect} from 'react';
import {act, render} from '@testing-library/react-native';
import {AsyncStorage} from '@amazon-devices/react-native-kepler';

import {DEFAULT_PROFILE, useStore, type Stored} from '~/state/store';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key: string) => memory.get(key) ?? null);
  jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key: string, value: string) => {
    memory.set(key, value);
  });
});

function Probe({onStored, save}: {onStored: (s: Stored | null | undefined) => void; save?: Stored}) {
  const {stored, save: persist} = useStore();
  const loaded = stored !== undefined;
  useEffect(() => {
    onStored(stored);
  }, [stored, onStored]);
  useEffect(() => {
    if (save && loaded) persist(save);
  }, [save, loaded, persist]);
  return null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useStore', () => {
  it('keeps the learned threshold across a restart', async () => {
    const learned: Stored = {profile: {...DEFAULT_PROFILE, personalBias: 0.86}, stats: {sessions: 1, adaptations: 2}};

    const first = render(<Probe onStored={jest.fn()} save={learned} />);
    await flush();
    first.unmount();

    let reloaded: Stored | null | undefined;
    render(
      <Probe
        onStored={s => {
          reloaded = s;
        }}
      />,
    );
    await flush();
    expect(reloaded?.profile.personalBias).toBe(0.86);
    expect(reloaded?.stats.sessions).toBe(1);
  });
});

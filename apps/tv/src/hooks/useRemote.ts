import {useRef} from 'react';
import {useTVEventHandler, type HWEvent} from '@amazon-devices/react-native-kepler';

const KEY_UP = 1;

/** Calls `onKey` once per remote press; key-up events are ignored. */
export function useRemote(onKey: (key: string) => void, enabled = true) {
  const handler = useRef(onKey);
  handler.current = onKey;

  useTVEventHandler((event: HWEvent) => {
    if (enabled && event.eventKeyAction !== KEY_UP) handler.current(event.eventType);
  });
}

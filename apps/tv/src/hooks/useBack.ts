import {useEffect, useRef} from 'react';
import {BackHandler} from 'react-native';

/** Handles the remote's Back button. Return false from `onBack` to fall through to the system. */
export function useBack(onBack: () => boolean | void) {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handler.current() !== false);
    return () => sub.remove();
  }, []);
}

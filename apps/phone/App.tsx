import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PairScreen } from '~/features/pair/PairScreen';
import { SessionScreen } from '~/features/session/SessionScreen';

export default function App() {
  const [code, setCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const leave = useCallback((next?: string) => {
    setNotice(next ?? null);
    setCode(null);
  }, []);

  const pair = useCallback((next: string) => {
    setNotice(null);
    setCode(next);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {code ? <SessionScreen key={code} code={code} onLeave={leave} /> : <PairScreen notice={notice} onPair={pair} />}
    </SafeAreaProvider>
  );
}

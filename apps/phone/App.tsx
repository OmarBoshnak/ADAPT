import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PairScreen } from '~/features/pair/PairScreen';
import { RecordScreen } from '~/features/record/RecordScreen';
import { SessionScreen } from '~/features/session/SessionScreen';

type Route = { name: 'pair'; notice: string | null } | { name: 'session'; code: string } | { name: 'record' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'pair', notice: null });

  const leave = useCallback((notice?: string) => setRoute({ name: 'pair', notice: notice ?? null }), []);

  const screen = (() => {
    switch (route.name) {
      case 'session':
        return <SessionScreen key={route.code} code={route.code} onLeave={leave} />;
      case 'record':
        return <RecordScreen onBack={() => leave()} />;
      default:
        return (
          <PairScreen
            notice={route.notice}
            onPair={(code) => setRoute({ name: 'session', code })}
            onRecord={() => setRoute({ name: 'record' })}
          />
        );
    }
  })();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen}
    </SafeAreaProvider>
  );
}

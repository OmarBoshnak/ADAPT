import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { relayHost } from '~/config';
import { requestVoicePermission } from '~/hooks/useVoice';
import { colors, space, type } from '~/theme';
import { Screen } from '~/ui/Screen';
import { CODE_LENGTH, CodeInput } from './CodeInput';

type Props = { notice: string | null; onPair: (code: string) => void };

export function PairScreen({ notice, onPair }: Props) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const change = async (next: string) => {
    setCode(next);
    if (next.length < CODE_LENGTH) return;
    // Asked here, while the phone is in hand, rather than once it is on the floor.
    setJoining(true);
    await requestVoicePermission();
    onPair(next);
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={type.eyebrow}>ADAPT · Floor sensor</Text>
        <Text style={[type.display, styles.title]}>Enter the code on your TV</Text>
        <CodeInput value={code} onChange={change} editable={!joining} />
        {notice && <Text style={styles.notice}>{notice}</Text>}
      </View>
      <Text style={styles.footer}>{`Relay ${relayHost} · same Wi-Fi as this phone`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg },
  title: { marginBottom: space.md },
  notice: { ...type.body, color: colors.text, textAlign: 'center' },
  footer: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center' },
});

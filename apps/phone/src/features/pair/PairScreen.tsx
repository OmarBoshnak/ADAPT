import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { relayHost } from '~/config';
import { requestVoicePermission } from '~/hooks/useVoice';
import { useRecordingAvailable } from '~/state/traces';
import { colors, space, type } from '~/theme';
import { Button } from '~/ui/Button';
import { Screen } from '~/ui/Screen';
import { CODE_LENGTH, CodeInput } from './CodeInput';

type Props = { notice: string | null; onPair: (code: string) => void; onRecord: () => void };

export function PairScreen({ notice, onPair, onRecord }: Props) {
  const canRecord = useRecordingAvailable();
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
      {canRecord && <Button label="Record floor traces" variant="quiet" onPress={onRecord} style={styles.record} />}
      <Text style={styles.footer}>{`Relay ${relayHost} · same Wi-Fi as this phone`}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg },
  title: { marginBottom: space.md },
  notice: { ...type.body, color: colors.text, textAlign: 'center' },
  record: { marginBottom: space.md },
  footer: { ...type.body, fontSize: 14, color: colors.textDim, textAlign: 'center' },
});

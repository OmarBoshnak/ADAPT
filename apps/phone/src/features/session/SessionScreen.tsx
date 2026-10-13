import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import type { HeardCommand, TvPhase } from '@adapt/core';

import { useFloorDim } from '~/hooks/useFloorDim';
import { useMotion } from '~/hooks/useMotion';
import { useVoice } from '~/hooks/useVoice';
import { useSensorLink } from '~/state/link';
import { colors, space, type } from '~/theme';
import { Button } from '~/ui/Button';
import { Screen } from '~/ui/Screen';
import { phaseCopy, rejectionCopy, VOICE_HINT } from './copy';
import { QualityTrace } from './QualityTrace';
import { StatusRow } from './StatusRow';
import { useEcho } from './useEcho';

const RUNNING: ReadonlySet<TvPhase> = new Set(['getready', 'active', 'adapting', 'rest']);

type Props = { code: string; onLeave: (notice?: string) => void };

export function SessionScreen({ code, onLeave }: Props) {
  useKeepAwake();
  const link = useSensorLink(code);
  const { status, snapshot } = link;
  const connected = status.connection === 'open' && status.peer === 'present';
  const running = connected && RUNNING.has(snapshot.phase);
  const active = connected && snapshot.phase === 'active';
  const [echo, showEcho] = useEcho();

  const motion = useMotion(link.push);
  useFloorDim(running && snapshot.onFloor);
  const voice = useVoice(running, (heard: HeardCommand) => {
    if (heard.command !== 'pause' && !active) return;
    if (heard.command === 'easier' || heard.command === 'harder') link.correct(heard.command, heard.heard);
    else link.command(heard.command, heard.heard);
    showEcho(heard.heard);
  });

  useEffect(() => {
    if (status.connection === 'rejected') onLeave(rejectionCopy(status.rejectedReason));
  }, [status.connection, status.rejectedReason, onLeave]);

  const copy = phaseCopy(status, snapshot);
  const voiceHint = VOICE_HINT[voice];
  const press = (word: 'easier' | 'harder' | 'swap') => {
    if (word === 'swap') link.command('swap');
    else link.correct(word);
    showEcho(word === 'swap' ? 'swap this' : word);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={type.eyebrow}>{`TV ${code}`}</Text>
        <Button label="Leave" variant="quiet" onPress={() => onLeave()} style={styles.leave} />
      </View>

      <View style={styles.body}>
        <Text style={type.eyebrow}>{copy.eyebrow}</Text>
        <Text style={type.display} numberOfLines={2}>
          {copy.title}
        </Text>
        {copy.body && <Text style={type.body}>{copy.body}</Text>}
        {active && motion && <QualityTrace trace={snapshot.trace} />}
      </View>

      <View style={styles.status}>
        {motion === false ? (
          <StatusRow tone="muted" text="No motion sensors here. The TV keeps adapting on its own prediction." />
        ) : snapshot.onFloor ? (
          <StatusRow tone="ok" text="On the floor, feeling your steps" />
        ) : (
          <StatusRow tone="ask" text="Place me on the floor beside you, screen up" />
        )}
        {running && voiceHint && <StatusRow tone={voice === 'listening' ? 'ok' : 'muted'} text={voiceHint} />}
      </View>

      <View style={styles.controls}>
        {echo && <Text style={styles.echo}>{`“${echo}”`}</Text>}
        {active && (
          <>
            <Button label="Easier" size="large" onPress={() => press('easier')} />
            <View style={styles.secondary}>
              <Button label="Harder" variant="quiet" onPress={() => press('harder')} style={styles.flex} />
              <Button label="Swap this" variant="quiet" onPress={() => press('swap')} style={styles.flex} />
            </View>
          </>
        )}
        {connected && snapshot.phase === 'paused' && (
          <Button label="Resume" size="large" onPress={() => link.command('resume')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leave: { minHeight: 40, paddingHorizontal: space.md },
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  status: { gap: space.sm, marginBottom: space.lg },
  controls: { gap: space.sm },
  secondary: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  echo: { ...type.title, color: colors.volt, textAlign: 'center' },
});

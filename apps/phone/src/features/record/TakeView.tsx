import { StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { TAKE_SECONDS } from '@adapt/core';

import { colors, space, type } from '~/theme';
import { Button } from '~/ui/Button';
import type { TakeChoice } from './ChooseTake';
import { takeCue } from './takeCopy';
import { useTakeRecorder } from './useTakeRecorder';

type Props = { choice: TakeChoice; onDone: () => void; onAgain: () => void };

export function TakeView({ choice, onDone, onAgain }: Props) {
  useKeepAwake();
  const { movement, take, floor } = choice;
  const { stage, elapsedSec, countdownSec, hasMotion, retry } = useTakeRecorder({
    exerciseId: movement.id,
    name: movement.name,
    profile: movement.signalProfile,
    expectedCadence: movement.expectedCadence,
    take,
    floor,
  });

  const body: { title: string; detail: string; act?: boolean } = (() => {
    if (hasMotion === false) return { title: 'No motion sensors', detail: 'Record on a real iPhone.' };
    switch (stage.kind) {
      case 'placing':
        return { title: 'Place me on the floor', detail: 'Screen up, about half a metre from where you’ll move.' };
      case 'countdown':
        return { title: `${countdownSec}`, detail: `Get into position for ${movement.name}` };
      case 'recording': {
        const cue = takeCue(take, elapsedSec);
        const left = Math.max(0, Math.ceil(TAKE_SECONDS[take] - elapsedSec));
        return { title: `${left} s`, detail: cue.text, act: cue.act };
      }
      case 'uploading':
        return { title: 'Saving…', detail: 'Sending the trace to the relay' };
      case 'saved':
        return { title: 'Saved', detail: `${stage.file}\n${stage.rate?.toFixed(1) ?? '—'} samples a second` };
      case 'failed':
        return { title: 'Couldn’t save', detail: 'Is the relay still running with --record?' };
    }
  })();

  return (
    <View style={styles.screen}>
      <Text style={type.eyebrow}>{`${movement.name} · ${take}`}</Text>
      <View style={styles.body}>
        <Text style={[type.display, styles.title]}>{body.title}</Text>
        <Text style={[type.body, styles.detail, body.act && styles.act]}>{body.detail}</Text>
      </View>
      <View style={styles.actions}>
        {stage.kind === 'failed' && <Button label="Try again" onPress={retry} />}
        {stage.kind === 'saved' && <Button label="Record another" onPress={onAgain} />}
        <Button label={stage.kind === 'saved' ? 'Done' : 'Cancel'} variant="quiet" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  title: { fontSize: 64 },
  detail: { fontSize: 20, lineHeight: 28 },
  act: { color: colors.accent, fontWeight: '700' },
  actions: { gap: space.sm },
});

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exercise, Take } from '@adapt/core';

import { movementsByProfile, PROFILE_LABEL } from '~/exercises';
import { space, type } from '~/theme';
import { Button } from '~/ui/Button';
import { Choice } from '~/ui/Choice';
import { TAKE_OPTIONS } from './takeCopy';

export type TakeChoice = { movement: Exercise; take: Take; floor: 'hard' | 'soft' };

type Props = { initial: TakeChoice | null; onStart: (choice: TakeChoice) => void; onBack: () => void };

const GROUPS = movementsByProfile();

export function ChooseTake({ initial, onStart, onBack }: Props) {
  const [movement, setMovement] = useState<Exercise | null>(initial?.movement ?? null);
  const [take, setTake] = useState<Take>(initial?.take ?? 'steady');
  const [floor, setFloor] = useState<'hard' | 'soft'>(initial?.floor ?? 'hard');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.eyebrow}>Record a floor trace</Text>
        <Text style={type.title}>Take</Text>
        {TAKE_OPTIONS.map((o) => (
          <Choice key={o.take} label={o.label} detail={o.summary} selected={take === o.take} onPress={() => setTake(o.take)} />
        ))}

        <Text style={type.title}>Floor</Text>
        <View style={styles.row}>
          <Choice label="Hard floor" selected={floor === 'hard'} onPress={() => setFloor('hard')} />
          <Choice label="Carpet or mat" selected={floor === 'soft'} onPress={() => setFloor('soft')} />
        </View>

        <Text style={type.title}>Movement</Text>
        {GROUPS.map((group) => (
          <View key={group.profile} style={styles.group}>
            <Text style={type.eyebrow}>{PROFILE_LABEL[group.profile]}</Text>
            {group.movements.map((ex) => (
              <Choice key={ex.id} label={ex.name} selected={movement?.id === ex.id} onPress={() => setMovement(ex)} />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.actions}>
        <Button label="Back" variant="quiet" onPress={onBack} style={styles.flex} />
        <Button
          label={movement ? 'Record' : 'Pick a movement'}
          onPress={() => movement && onStart({ movement, take, floor })}
          style={[styles.grow, !movement && styles.inactive]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.sm, paddingBottom: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  group: { gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  flex: { flex: 1 },
  grow: { flex: 2 },
  inactive: { opacity: 0.4 },
});

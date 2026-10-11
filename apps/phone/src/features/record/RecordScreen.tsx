import { useState } from 'react';

import { Screen } from '~/ui/Screen';
import { ChooseTake, type TakeChoice } from './ChooseTake';
import { TakeView } from './TakeView';

export function RecordScreen({ onBack }: { onBack: () => void }) {
  const [choice, setChoice] = useState<TakeChoice | null>(null);
  const [recording, setRecording] = useState(false);
  const [attempt, setAttempt] = useState(0);

  return (
    <Screen>
      {recording && choice ? (
        <TakeView
          key={attempt}
          choice={choice}
          onDone={() => setRecording(false)}
          onAgain={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <ChooseTake
          initial={choice}
          onBack={onBack}
          onStart={(next) => {
            setChoice(next);
            setRecording(true);
          }}
        />
      )}
    </Screen>
  );
}

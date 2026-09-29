import { useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { matchCommand, PHRASES, type HeardCommand } from '@adapt/core';

export type VoiceState = 'off' | 'listening' | 'denied' | 'unavailable';

// Short windows rather than one long stream: iOS caps a request at a minute, and idle listening costs battery.
const WINDOW_MS = 8000;
const RESTART_MS = 250;
const RETRY_MS = 2000;
const COOLDOWN_MS = 1500;
const QUIET_ERRORS = new Set(['aborted', 'no-speech', 'speech-timeout']);

export async function requestVoicePermission(): Promise<boolean> {
  const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
  return permission?.granted ?? false;
}

/** Listens for the four session words while `enabled`. Recognition never leaves the device. */
export function useVoice(enabled: boolean, onHeard: (heard: HeardCommand) => void): VoiceState {
  const [state, setState] = useState<VoiceState>('off');
  const handler = useRef(onHeard);
  handler.current = onHeard;
  const listening = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHeardAt = useRef(0);
  const failed = useRef(false);

  const schedule = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const listen = () => {
    if (!listening.current) return;
    failed.current = false;
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      requiresOnDeviceRecognition: true,
      addsPunctuation: false,
      contextualStrings: PHRASES.map((p) => p.phrase),
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'],
        mode: 'measurement',
      },
    });
    schedule(() => ExpoSpeechRecognitionModule.stop(), WINDOW_MS);
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    ExpoSpeechRecognitionModule.getPermissionsAsync().then((permission) => {
      if (cancelled) return;
      if (!permission.granted) return setState('denied');
      if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) return setState('unavailable');
      listening.current = true;
      setState('listening');
      listen();
    });
    return () => {
      cancelled = true;
      listening.current = false;
      if (timer.current) clearTimeout(timer.current);
      ExpoSpeechRecognitionModule.abort();
      setState((s) => (s === 'listening' ? 'off' : s));
    };
  }, [enabled]);

  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results[0];
    if (!best || !listening.current) return;
    const heard = matchCommand(best.transcript, event.isFinal ? best.confidence : -1);
    if (!heard || Date.now() - lastHeardAt.current < COOLDOWN_MS) return;
    lastHeardAt.current = Date.now();
    handler.current(heard);
    // A fresh request, so the next word is not judged alongside this one.
    ExpoSpeechRecognitionModule.abort();
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'not-allowed') {
      listening.current = false;
      setState('denied');
    } else if (event.error === 'language-not-supported' || event.error === 'service-not-allowed') {
      listening.current = false;
      setState('unavailable');
    } else if (!QUIET_ERRORS.has(event.error)) {
      failed.current = true;
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (listening.current) schedule(listen, failed.current ? RETRY_MS : RESTART_MS);
  });

  return state;
}

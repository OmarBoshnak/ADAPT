#!/usr/bin/env node
/**
 * adapt-fake-sensor — the phone, without a phone.
 *
 * Joins the relay as the sensor, follows the TV's `session.exercise` announcements, and
 * synthesises floor vibration for whatever movement is running. Every sample goes through
 * the real QualityEstimator — the same code the phone runs — and a scored frame goes to the
 * TV twice a second.
 *
 *   npm run fake-sensor -- --code 4821
 *
 * Keys:  e  say "easier"    h  say "harder"    d  drop off the network for 8 s    q  quit
 *
 * Scripted (for unattended runs):
 *   --easier-after <s>   say "easier" this many seconds after the first exercise starts
 *   --drop-after <s>     vanish this many seconds in (Wi-Fi blip), back 8 s later
 *   --strong             hold form throughout instead of fading
 *   --speed <n>          run faster than real time — must match console-tv's --speed
 */

import {
  hashString,
  QualityEstimator,
  RelayClient,
  SAMPLE_RATE,
  synthesizeTrace,
  type protocol,
  type SensorSample,
} from '@adapt/core';

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const code = opt('code');
if (!code) {
  console.error('usage: adapt-fake-sensor --code <4 digits> [--url ws://127.0.0.1:8787/ws] [--speed 1] [--strong]');
  process.exit(2);
}
const url = opt('url', 'ws://127.0.0.1:8787/ws') as string;
const speed = Number(opt('speed', '1'));
const strong = flag('strong');
const easierAfter = opt('easier-after') ? Number(opt('easier-after')) : null;
const dropAfter = opt('drop-after') ? Number(opt('drop-after')) : null;

const log = (line: string) => console.log(`[phone ${clockLabel()}] ${line}`);

// ── state ────────────────────────────────────────────────────────────────────
let seq = 0;
let measuring = false;
let exercise: protocol.MessageOf<'session.exercise'> | null = null;
let estimator: QualityEstimator | null = null;
let trace: SensorSample[] = [];
let traceIndex = 0;
let sampleCount = 0;
let firstExerciseAt: number | null = null; // scaled seconds
let saidEasier = false;
let dropped = false;
const startedAt = Date.now();

function scaledNow(): number {
  return ((Date.now() - startedAt) / 1000) * speed;
}
function clockLabel(): string {
  const s = Math.floor(scaledNow());
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── relay ────────────────────────────────────────────────────────────────────
let lastConnection = '';
const client = new RelayClient({
  url,
  role: 'sensor',
  code,
  client: 'adapt-fake-sensor/0.1',
  onStatus: (s) => {
    if (s.connection !== lastConnection) {
      lastConnection = s.connection;
      log(s.connection === 'rejected' ? `rejected: ${s.rejectedReason}` : `relay ${s.connection}${s.connection === 'open' ? ` · room ${s.code}` : ''}`);
      if (s.connection === 'rejected') process.exit(1);
      if (s.connection === 'open') client.send('sensor.status', { onFloor: true });
    }
  },
  onMessage: (m) => {
    if (m.type === 'session.exercise') {
      // After a reconnect the relay replays the TV's last announcement and the TV resyncs as
      // well. Same seq means same movement: keep measuring rather than re-baselining twice.
      if (exercise && m.seq === seq) return;
      seq = m.seq;
      exercise = m;
      estimator = new QualityEstimator({ profile: m.signalProfile, expectedCadence: m.expectedCadence });
      // A fading person loses form faster on harder movements, and later in the session.
      const into = firstExerciseAt === null ? 0 : scaledNow() - firstExerciseAt;
      const perMin = strong ? 0 : 0.35 * (1 + into / 300);
      const fade = (t: number) => Math.max(0.35, 1 - (perMin * t) / 60);
      trace = synthesizeTrace({
        profile: m.signalProfile,
        durationSec: 600,
        cadencePerMin: m.expectedCadence ?? 60,
        fade,
        jitter: (t) => 0.04 + 0.12 * (1 - fade(t)),
        pace: (t) => 1 - 0.15 * (1 - fade(t)),
        seed: hashString(`${m.seq}:${m.exerciseId}`),
      });
      traceIndex = 0;
      firstExerciseAt ??= scaledNow();
      log(`measuring ${m.name} (seq ${m.seq}, ${m.signalProfile})`);
    } else if (m.type === 'session.state') {
      measuring = m.phase === 'active';
      if (m.phase === 'complete') {
        log('session complete');
        setTimeout(() => shutdown(), 500);
      }
    } else if (m.type === 'session.adapted') {
      log(`TV switched ${m.from} → ${m.to}`);
    } else if (m.type === 'peer') {
      log(`TV ${m.status}`);
    }
  },
});
client.start();

// ── the sampling loop: SAMPLE_RATE × speed samples per real second ───────────
const LOOP_MS = 100;
const perLoop = Math.round((SAMPLE_RATE * speed * LOOP_MS) / 1000);
const framesEvery = SAMPLE_RATE / 2;

const loop = setInterval(() => {
  if (dropped || !measuring || !estimator || !exercise) return;
  for (let i = 0; i < perLoop; i++) {
    const s = trace[traceIndex++];
    if (!s) break;
    estimator.push(s);
    if (++sampleCount % framesEvery === 0) {
      const f = estimator.frame();
      client.send('sensor.frame', {
        seq,
        t: f.t,
        quality: Math.min(1, Math.max(0, f.quality)),
        cadence: f.cadence,
        confidence: f.confidence,
        profile: f.profile,
      });
    }
  }

  if (firstExerciseAt !== null) {
    const into = scaledNow() - firstExerciseAt;
    if (easierAfter !== null && !saidEasier && into >= easierAfter) {
      saidEasier = true;
      say('easier');
    }
    if (dropAfter !== null && into >= dropAfter && !dropped && !droppedOnce) drop();
  }
}, LOOP_MS);

function say(word: 'easier' | 'harder') {
  client.send('user.correction', { direction: word, source: 'voice', heard: word });
  log(`said "${word}"`);
}

let droppedOnce = false;
function drop() {
  droppedOnce = true;
  dropped = true;
  client.stop();
  log('dropped off the network');
  setTimeout(() => {
    dropped = false;
    client.start();
    log('back on the network');
  }, 8000 / speed);
}

// ── keys ─────────────────────────────────────────────────────────────────────
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (k: string) => {
    if (k === 'e') say('easier');
    else if (k === 'h') say('harder');
    else if (k === 'd' && !dropped) drop();
    else if (k === 'q' || k === '\u0003') shutdown();
  });
  log('keys: e easier · h harder · d drop network · q quit');
}

function shutdown() {
  clearInterval(loop);
  client.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

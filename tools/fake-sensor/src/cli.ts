#!/usr/bin/env node
// The phone, without a phone: synthesises floor vibration and runs it through the same SensorSession the phone uses.
//
//   npm run fake-sensor -- --code 4821 [--replay [dir]] [--easier-after s] [--drop-after s] [--strong] [--speed n]
//   keys: e easier · h harder · s swap this · p pause · r resume · d drop off the network for 8 s · q quit

import {
  hashString,
  RelayClient,
  SAMPLE_RATE,
  SensorSession,
  synthesizeTrace,
  unpackTrace,
  type Command,
  type MeasuredExercise,
  type SensorSample,
  type Trace,
} from '@adapt/core';
import { FIXTURES_DIR, loadTraces } from '@adapt/data/fixtures';

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
const replayArg = opt('replay');
const replayDir = flag('replay') ? (replayArg && !replayArg.startsWith('--') ? replayArg : FIXTURES_DIR) : null;
const recorded = replayDir ? loadTraces(replayDir).map((r) => r.trace) : [];
if (replayDir && !recorded.length) console.warn(`No traces in ${replayDir}; falling back to synthetic floor vibration.`);

const log = (line: string) => console.log(`[phone ${clockLabel()}] ${line}`);

let trace: SensorSample[] = [];
let traceIndex = 0;
let loopFrom = 0;
let sampleT = 0;
let measuredSeq: number | null = null;
let firstExerciseAt: number | null = null;
let saidEasier = false;
let dropped = false;
let droppedOnce = false;
const startedAt = Date.now();

function scaledNow(): number {
  return ((Date.now() - startedAt) / 1000) * speed;
}
function clockLabel(): string {
  const s = Math.floor(scaledNow());
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

let lastConnection = '';
const client = new RelayClient({
  url,
  role: 'sensor',
  code,
  client: 'adapt-fake-sensor/0.1',
  onStatus: (s) => {
    if (s.connection === lastConnection) return;
    lastConnection = s.connection;
    log(s.connection === 'rejected' ? `rejected: ${s.rejectedReason}` : `relay ${s.connection}${s.connection === 'open' ? ` · room ${s.code}` : ''}`);
    if (s.connection === 'rejected') process.exit(1);
    if (s.connection === 'open') session.announceFloor();
  },
  onMessage: (m) => {
    session.receive(m);
    if (m.type === 'session.state' && m.phase === 'complete') {
      log('session complete');
      setTimeout(() => shutdown(), 500);
    } else if (m.type === 'session.adapted') {
      log(`TV switched ${m.from} → ${m.to}`);
    } else if (m.type === 'peer') {
      log(`TV ${m.status}`);
    }
  },
});
const session = new SensorSession({ send: (type, payload) => client.send(type, payload) });

session.subscribe((s) => {
  if (!s.exercise || s.exercise.seq === measuredSeq) return;
  measuredSeq = s.exercise.seq;
  const real = pickRecording(s.exercise);
  trace = real ? unpackTrace(real) : synthesize(s.exercise);
  // A recording shorter than the segment keeps replaying its final stretch, so a fade stays faded.
  loopFrom = real ? Math.floor(trace.length * 0.7) : 0;
  traceIndex = 0;
  firstExerciseAt ??= scaledNow();
  const source = real ? `recorded ${real.take} ${real.name}` : 'synthetic';
  log(`measuring ${s.exercise.name} (seq ${s.exercise.seq}, ${s.exercise.profile}, ${source})`);
});
client.start();

function pickRecording(ex: MeasuredExercise): Trace | undefined {
  const takes = strong ? ['steady', 'fading'] : ['fading', 'steady'];
  const ranked = recorded
    .filter((t) => t.take !== 'pickup' && (t.name === ex.name || t.profile === ex.profile))
    .sort((a, b) => Number(b.name === ex.name) - Number(a.name === ex.name) || takes.indexOf(a.take) - takes.indexOf(b.take));
  return ranked[0];
}

function synthesize(ex: MeasuredExercise): SensorSample[] {
  const into = firstExerciseAt === null ? 0 : scaledNow() - firstExerciseAt;
  const perMin = strong ? 0 : 0.35 * (1 + into / 300);
  const fade = (t: number) => Math.max(0.35, 1 - (perMin * t) / 60);
  return synthesizeTrace({
    profile: ex.profile,
    durationSec: 600,
    cadencePerMin: ex.expectedCadence ?? 60,
    fade,
    jitter: (t) => 0.04 + 0.12 * (1 - fade(t)),
    pace: (t) => 1 - 0.15 * (1 - fade(t)),
    seed: hashString(`${ex.seq}:${ex.name}`),
  });
}

const quiet = synthesizeTrace({ profile: 'static', durationSec: 10, cadencePerMin: 0 });
const LOOP_MS = 100;
const perLoop = Math.round((SAMPLE_RATE * speed * LOOP_MS) / 1000);

const loop = setInterval(() => {
  if (dropped) return;
  for (let i = 0; i < perLoop; i++) {
    if (session.measuring && traceIndex >= trace.length) traceIndex = loopFrom;
    const source = session.measuring ? trace[traceIndex++] : quiet[Math.round(sampleT * SAMPLE_RATE) % quiet.length];
    if (!source) break;
    session.push({ ...source, t: sampleT });
    sampleT += 1 / SAMPLE_RATE;
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

function command(command: Command, heard?: string) {
  client.send('user.command', heard ? { command, source: 'voice', heard } : { command, source: 'button' });
  log(heard ? `said "${heard}"` : `pressed ${command}`);
}

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

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (k: string) => {
    if (k === 'e') say('easier');
    else if (k === 'h') say('harder');
    else if (k === 's') command('swap', 'swap this');
    else if (k === 'p') command('pause', 'pause');
    else if (k === 'r') command('resume');
    else if (k === 'd' && !dropped) drop();
    else if (k === 'q' || k === '\u0003') shutdown();
  });
  log('keys: e easier · h harder · s swap this · p pause · r resume · d drop network · q quit');
}

function shutdown() {
  clearInterval(loop);
  client.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

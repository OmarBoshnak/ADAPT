#!/usr/bin/env node
/**
 * adapt-console-tv — the TV, in a terminal.
 *
 * Runs the same LiveSession class the Vega app renders, so everything here — pairing,
 * seq-stamped exercise announcements, falling back to solo when the phone drops, learning
 * from a spoken "easier" — is the real behaviour, just printed instead of drawn.
 *
 *   npm run console-tv                         paired: shows a code, waits for a phone
 *   npm run console-tv -- --solo               a Fire TV and a remote, nothing else
 *
 * Keys:  enter start    e easier    h harder    p pause/resume    q quit
 *
 *   --minutes 12  --energy medium  --seed 5  --bias 1  --knee
 *   --speed <n>        faster than real time (match fake-sensor's --speed)
 *   --autostart <s>    start this many seconds after launch, or once a phone joins
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adaptsInLabel,
  generatePlan,
  getExercise,
  learningCopy,
  LiveSession,
  RelayClient,
  summaryFor,
  type Energy,
  type ExerciseGraph,
  type Profile,
} from '@adapt/core';

const here = dirname(fileURLToPath(import.meta.url));
const graph = JSON.parse(
  readFileSync(resolve(here, '../../../packages/data/generated/session-graph.json'), 'utf8'),
) as ExerciseGraph;

// ── args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? (args[i + 1] as string) : d;
};

const solo = flag('solo');
const url = opt('url', 'ws://127.0.0.1:8787/ws');
const speed = Number(opt('speed', '1'));
const minutes = Number(opt('minutes', '12'));
const energy = opt('energy', 'medium') as Energy;
const seed = Number(opt('seed', '5'));
const autostart = args.includes('--autostart') ? Number(opt('autostart', '0')) : null;

const profile: Profile = {
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: flag('knee') ? ['knee'] : [],
  conditions: [],
  defaultDurationMin: minutes,
  intensityPreference: 'steady',
  personalBias: Number(opt('bias', '1')),
};

const ctx = { graph, profile, energy };
const plan = generatePlan({ graph, profile, durationMin: minutes, energy, seed });

// ── scaled clock, shared by the session ──────────────────────────────────────
const t0 = Date.now();
const now = () => t0 + (Date.now() - t0) * speed;
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const name = (id: string) => getExercise(graph, id).name;

let live: LiveSession | null = null;
const log = (line: string) => console.log(`[tv ${live ? mmss(live.snapshot.state.sessionElapsedSec) : '--:--'}] ${line}`);

// ── relay ────────────────────────────────────────────────────────────────────
let lastConn = '';
let lastPeer = '';
const relay = solo
  ? null
  : new RelayClient({
      url,
      role: 'display',
      client: 'adapt-console-tv/0.1',
      onStatus: (s) => {
        if (s.connection !== lastConn) {
          lastConn = s.connection;
          if (s.connection === 'open') {
            console.log(`\n   PAIR YOUR PHONE    ${s.code?.split('').join(' ')}\n`);
            console.log(`   CODE=${s.code}`); // machine-readable, for scripts
          } else log(`relay ${s.connection}`);
        }
        if (s.peer !== lastPeer) {
          lastPeer = s.peer;
          log(s.peer === 'present' ? 'phone connected' : s.peer === 'lost' ? 'phone lost — carrying on solo' : 'no phone');
          live?.setPeer(s.peer);
          if (s.peer === 'present' && autostart !== null) begin();
        }
      },
      onMessage: (m) => live?.receive(m),
    });
relay?.start();

// ── session ──────────────────────────────────────────────────────────────────
console.log(`\n${plan.title} · ${solo ? 'solo (TV and remote only)' : 'paired'} · seed ${seed} · bias ${profile.personalBias}`);
console.log(`plan: ${plan.segments.map((s) => name(s.exerciseId)).join(' → ')}`);
if (plan.exclusionLabels.length) console.log(`footer: ${plan.exclusionLabels.join(' · ')}`);

function begin() {
  if (live) return;
  live = new LiveSession({
    ctx,
    plan,
    now,
    maxStepSec: Math.max(1, speed),
    ...(relay ? { send: (type, payload) => relay.send(type, payload) } : {}),
  });
  if (relay?.status.peer === 'present') live.setPeer('present');

  let adaptations = 0;
  let heardAt = 0;
  let lastPhase = '';
  let lastExercise = '';
  live.subscribe((s) => {
    const st = s.state;
    if (st.phase !== lastPhase) {
      lastPhase = st.phase;
      if (st.phase === 'getready') log('GET READY');
      if (st.phase === 'rest') log('rest');
    }
    const exKey = `${st.segmentIndex}:${st.currentExerciseId}`;
    if (st.phase === 'active' && exKey !== lastExercise) {
      lastExercise = exKey;
      log(`▶ ${name(st.currentExerciseId)}  (exercise ${st.segmentIndex + 1} of ${st.plan.segments.length})`);
    }
    if (st.adaptations.length > adaptations) {
      adaptations = st.adaptations.length;
      const a = st.adaptations[adaptations - 1];
      if (a) {
        const tag = a.trigger === 'predicted-strain' ? '▼ I NOTICED ' : 'U I LEARNED ';
        const move = a.action === 'switch' ? `${name(a.fromExerciseId)} → ${name(a.toExerciseId)}` : `${name(a.fromExerciseId)} ended early`;
        log(`${tag} ${move} — "${a.reason}"`);
      }
    }
    if (s.heard && s.heard.atMs !== heardAt) {
      heardAt = s.heard.atMs;
      log(`🎙  heard "${s.heard.word}" · NOTED FOR NEXT TIME`);
    }
    if (st.phase === 'complete') finish();
  });
  live.start();
}

// a status line every (scaled) 15 s
const status = setInterval(() => {
  if (!live || live.snapshot.state.phase !== 'active') return;
  const s = live.snapshot;
  const p = live.projection();
  const bar = (v: number, T: number) => {
    const n = Math.round(Math.min(1.2, v / T) * 20);
    return '█'.repeat(Math.min(n, 20)) + '░'.repeat(Math.max(0, 20 - n));
  };
  const q = s.state.quality === null ? '  —' : s.state.quality.toFixed(2);
  log(
    `strain ${bar(s.state.strain, s.state.T)} ${s.state.strain.toFixed(0)}/${s.state.T.toFixed(0)}  ${adaptsInLabel(p.secondsUntilThreshold) ?? 'NO ADAPTATION EXPECTED'}  · quality ${q} · ${s.mode}`,
  );
}, 15_000 / speed);

function finish() {
  if (!live) return;
  const sum = summaryFor(ctx, live.snapshot.state);
  console.log('\n── SESSION COMPLETE ─────────────────────────────────────');
  console.log(`   duration ${mmss(sum.durationSec)} · reps ~${sum.totalReps} · adaptations ${sum.adaptations.length}`);
  if (sum.adaptedExerciseNames.length) console.log(`   adapted: ${sum.adaptedExerciseNames.join(', ')}`);
  const card = learningCopy(live.snapshot.state.learning.at(-1) ?? null);
  if (card) console.log(`   WHAT CHANGED  ${card.headline}\n                 ${card.detail}`);
  console.log(`   bias ${sum.biasBefore.toFixed(3)} → ${sum.biasAfter.toFixed(3)}   (run again with --bias ${sum.biasAfter.toFixed(3)})\n`);
  shutdown(0);
}

// ── start ────────────────────────────────────────────────────────────────────
if (autostart !== null) setTimeout(begin, (autostart * 1000) / speed);

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (k: string) => {
    if (k === '\r' || k === '\n') begin();
    else if (k === 'e') live?.correct('easier', 'button');
    else if (k === 'h') live?.correct('harder', 'button');
    else if (k === 'p') {
      if (live?.snapshot.paused) live.resume();
      else live?.pause();
    }
    else if (k === 'q' || k === '\u0003') shutdown(0);
  });
  console.log('keys: enter start · e easier · h harder · p pause · q quit\n');
}

function shutdown(code: number) {
  clearInterval(status);
  live?.stop();
  relay?.stop();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

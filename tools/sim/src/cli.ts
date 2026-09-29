#!/usr/bin/env node
// npm run sim             two-session demo arc; exits non-zero unless session two adapts visibly sooner
// npm run sim -- converge  a person 20% below the model's guess, over several sessions

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getExercise,
  threshold,
  type Adaptation,
  type ExerciseGraph,
  type Profile,
  type SessionState,
  type StrainPoint,
} from '@adapt/core';

import { runSession, type RunResult } from './run.js';

const here = dirname(fileURLToPath(import.meta.url));
const graphPath = resolve(here, '../../../packages/data/generated/session-graph.json');
const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as ExerciseGraph;

// Seed 5 puts Jumping Jacks where the model first reaches its threshold.
const DEMO_SEED = 5;

const SPEAKS_AFTER_SEC = 60;

// Session two must adapt the same movement at most this fraction as far in, and MIN_GAIN_SEC sooner.
const MAX_RELATIVE_POSITION = 0.6;
const MIN_GAIN_SEC = 20;
const ENERGY = 'medium' as const;
const DURATION_MIN = 12;

// No injury: the knee rule would (correctly) exclude Jumping Jacks.
const DEMO_PROFILE: Profile = {
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: [],
  conditions: [],
  defaultDurationMin: DURATION_MIN,
  intensityPreference: 'steady',
  personalBias: 1,
};

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const name = (id: string) => getExercise(graph, id).name;

function chart(series: StrainPoint[], T: number, adaptations: Adaptation[], width = 72, height = 11): string {
  const end = series[series.length - 1]?.t ?? 1;
  const maxY = Math.max(T * 1.1, ...series.map((p) => p.s));
  const cols: number[] = new Array(width).fill(-1);
  for (const p of series) {
    const x = Math.min(width - 1, Math.floor((p.t / end) * (width - 1)));
    cols[x] = Math.max(cols[x] as number, p.s);
  }
  // Rests sample less often; carry values across the gaps.
  for (let x = 1; x < width; x++) if ((cols[x] as number) < 0) cols[x] = cols[x - 1] as number;

  const row = (v: number) => Math.round((v / maxY) * (height - 1));
  const tRow = row(T);
  const marks = new Set(adaptations.map((a) => Math.min(width - 1, Math.floor((a.atSec / end) * (width - 1)))));
  const kinds = new Map(adaptations.map((a) => [Math.min(width - 1, Math.floor((a.atSec / end) * (width - 1))), a.trigger]));

  const lines: string[] = [];
  let markLine = '';
  for (let x = 0; x < width; x++) markLine += marks.has(x) ? (kinds.get(x) === 'user-correction' ? 'U' : '▼') : ' ';
  lines.push(`        ${markLine}`);
  for (let y = height - 1; y >= 0; y--) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const v = cols[x] as number;
      const r = v < 0 ? -1 : row(v);
      if (r === y) line += '●';
      else if (y === tRow) line += '┄';
      else if (r > y && v >= 0) line += '·';
      else line += ' ';
    }
    const label = y === tRow ? ' T ' : '   ';
    lines.push(`   ${label}│${line}`);
  }
  lines.push(`       └${'─'.repeat(width)}`);
  lines.push(`        00:00${' '.repeat(Math.max(0, width - 10))}${mmss(end)}`);
  return lines.join('\n');
}

function firstAuto(r: RunResult): Adaptation | undefined {
  return r.state.adaptations.find((a) => a.trigger === 'predicted-strain');
}

function report(title: string, r: RunResult) {
  const { plan, state, summary } = r;
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 70 - title.length))}`);
  console.log(`   ${plan.title} · threshold ${state.T.toFixed(1)} · bias in ${summary.biasBefore.toFixed(3)}`);
  console.log(
    `   plan: ${plan.segments
      .map((s) => `${name(s.exerciseId)}${getExercise(graph, s.exerciseId).source === 'free-exercise-db' ? '·db' : ''}`)
      .join(' → ')}`,
  );
  console.log('');
  for (const a of state.adaptations) {
    const icon = a.trigger === 'predicted-strain' ? '▼ I noticed' : 'U I learned';
    const move = a.action === 'switch' ? `${name(a.fromExerciseId)} → ${name(a.toExerciseId)}` : `${name(a.fromExerciseId)} ended early`;
    console.log(`   [${mmss(a.atSec)}] ${icon.padEnd(12)} ${move.padEnd(40)} "${a.reason}"`);
  }
  for (const l of state.learning) {
    const predicted = l.predictedAtSec === null ? 'no adaptation expected' : `expected ${mmss(l.predictedAtSec)}`;
    console.log(
      `   [${mmss(l.atSec)}] ↳ correction "${l.direction}" — ${predicted}, ${mmss(l.earlySec)} early · bias ${l.biasBefore.toFixed(3)} → ${l.biasAfter.toFixed(3)}`,
    );
  }
  if (state.adaptations.length === 0) console.log('   (no adaptations)');
  console.log('');
  console.log(chart(summary.strainSeries, state.T, state.adaptations));
  console.log('');
  console.log(`   duration ${mmss(summary.durationSec)} · reps ~${summary.totalReps} · adaptations ${summary.adaptations.length}`);
  if (summary.learning) {
    console.log(`   TV-10 learning card: "${summary.learning.headline}"`);
    console.log(`                        "${summary.learning.detail}"`);
  } else {
    console.log('   TV-10 learning card: (not shown — no correction this session)');
  }
}

function demo(): number {
  console.log('\nADAPT — the two-session demo arc');
  console.log('================================');
  console.log(`Session 1: the model adapts on its own; ${SPEAKS_AFTER_SEC} s later the person says "easier".`);
  console.log('Session 2: same person, same plan seed, no words — it should adapt sooner.');

  let spoken = false;
  const s1 = runSession({
    graph,
    profile: DEMO_PROFILE,
    energy: ENERGY,
    durationMin: DURATION_MIN,
    seed: DEMO_SEED,
    paired: true,
    user: 'fading',
    speak: (s: SessionState) => {
      const auto = s.adaptations.find((a) => a.trigger === 'predicted-strain');
      if (spoken || !auto || s.phase !== 'active' || s.sessionElapsedSec < auto.atSec + SPEAKS_AFTER_SEC) return null;
      spoken = true;
      return { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' };
    },
  });
  report('Session 1 · paired · fading · says "easier"', s1);

  const learned: Profile = { ...DEMO_PROFILE, personalBias: s1.state.bias };
  const s2 = runSession({
    graph,
    profile: learned,
    energy: ENERGY,
    durationMin: DURATION_MIN,
    seed: DEMO_SEED,
    paired: true,
    user: 'fading',
  });
  report('Session 2 · paired · fading · silent · learned bias', s2);

  const solo = runSession({
    graph,
    profile: DEMO_PROFILE,
    energy: ENERGY,
    durationMin: DURATION_MIN,
    seed: DEMO_SEED,
    paired: false,
    user: 'fading',
  });
  report('Solo · Fire TV and remote only · no phone', solo);

  const a1 = firstAuto(s1);
  const a2 = firstAuto(s2);
  const a0 = firstAuto(solo);

  console.log('\n── Result ──────────────────────────────────────────────────────────────');
  console.log('                          first auto-adapt   adaptations   bias after');
  const row = (label: string, r: RunResult, a?: Adaptation) =>
    console.log(
      `   ${label.padEnd(24)}${(a ? mmss(a.atSec) : '—').padStart(10)}${String(r.state.adaptations.length).padStart(14)}${r.state.bias.toFixed(3).padStart(13)}`,
    );
  row('session 1 (paired)', s1, a1);
  row('session 2 (paired)', s2, a2);
  row('solo (no phone)', solo, a0);

  const load = (r: RunResult) =>
    r.plan.segments.reduce((acc, seg) => acc + getExercise(graph, seg.exerciseId).intensity * seg.durationSec, 0) / 60;
  console.log('');
  console.log(`   planned load  session 1 ${load(s1).toFixed(1)}  →  session 2 ${load(s2).toFixed(1)}   ("starts lighter")`);

  const sameMove = !!a1 && !!a2 && a1.fromExerciseId === a2.fromExerciseId;
  const gain = a1 && a2 ? a1.atSec - a2.atSec : -Infinity;
  const relative = a1 && a2 && a1.segmentElapsedSec > 0 ? a2.segmentElapsedSec / a1.segmentElapsedSec : Infinity;
  if (a1 && a2) {
    console.log(
      `   hero moment   ${name(a1.fromExerciseId)} adapted ${Math.round(a1.segmentElapsedSec)} s in (session 1)  →  ${Math.round(a2.segmentElapsedSec)} s in (session 2)`,
    );
  }
  const pass =
    sameMove &&
    relative <= MAX_RELATIVE_POSITION &&
    gain >= MIN_GAIN_SEC &&
    s1.state.bias < 1 &&
    !!s1.summary.learning &&
    load(s2) <= load(s1) &&
    s2.state.corrections.length === 0;
  console.log('');
  if (pass && a1) {
    console.log(
      `   ✓ Same movement, adapted ${Math.round((1 - relative) * 100)}% sooner into it (${mmss(gain)} earlier), unprompted, from a lighter plan.`,
    );
    console.log(`     The arc holds.`);
  } else {
    console.log('   ✗ The demo arc did not hold.');
    if (!sameMove) console.log('     · session 2 must adapt the same movement first');
    if (relative > MAX_RELATIVE_POSITION) console.log(`     · must fire ≤ ${MAX_RELATIVE_POSITION * 100}% as far into it (got ${Math.round(relative * 100)}%)`);
    if (gain < MIN_GAIN_SEC) console.log(`     · must be ≥ ${MIN_GAIN_SEC}s sooner`);
    if (load(s2) > load(s1)) console.log('     · session 2 plan must be no heavier');
  }
  console.log('');
  return pass ? 0 : 1;
}

function converge(): number {
  const T0 = threshold(DEMO_PROFILE, ENERGY);
  const trueLimit = 0.8 * T0;
  console.log('\nADAPT — learning a person the model misjudged');
  console.log('==============================================');
  console.log(`The model starts at threshold ${T0.toFixed(1)}. This person actually needs easier at ${trueLimit.toFixed(1)}.`);
  console.log('Each session they say "easier" when they need it. Watch the model close the gap.\n');
  console.log('   session   threshold   who acted first        corrections   bias after');

  let bias = 1;
  for (let k = 1; k <= 6; k++) {
    let lastSpokeAt = -Infinity;
    const r = runSession({
      graph,
      profile: { ...DEMO_PROFILE, personalBias: bias },
      energy: ENERGY,
      durationMin: DURATION_MIN,
      seed: DEMO_SEED,
      paired: true,
      user: 'fading',
      speak: (s) => {
        if (s.phase !== 'active' || s.strain < trueLimit) return null;
        if (s.sessionElapsedSec - lastSpokeAt < 60) return null;
        lastSpokeAt = s.sessionElapsedSec;
        return { type: 'CORRECTION', direction: 'easier', source: 'voice', heard: 'easier' };
      },
    });
    const first = r.state.adaptations[0];
    const who = !first ? 'nobody' : first.trigger === 'predicted-strain' ? `model  ${mmss(first.atSec)}` : `person ${mmss(first.atSec)}`;
    console.log(
      `   ${String(k).padStart(7)}   ${r.state.T.toFixed(1).padStart(9)}   ${who.padEnd(21)}${String(r.state.corrections.length).padStart(12)}${r.state.bias.toFixed(3).padStart(13)}`,
    );
    bias = r.state.bias;
  }
  console.log(`\n   The model's threshold converges toward the person's real limit, and once it`);
  console.log(`   gets there it acts first — the person stops needing to ask.\n`);
  return 0;
}

const scenario = process.argv[2] ?? 'demo';
process.exit(scenario === 'converge' ? converge() : demo());

#!/usr/bin/env node
/**
 * adapt-build-graph
 *
 * Reads the vendored Free Exercise DB, the authored home pack and the pool curation, builds
 * the adaptation graph, validates it, and writes:
 *
 *   packages/data/generated/graph.json          the whole enriched corpus
 *   packages/data/generated/session-graph.json  the session pool only — what the TV bundles
 *
 * Exits non-zero if any pool ladder is broken, so a bad edge can never reach a screen.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildGraph,
  eligibilityFor,
  selectableIds,
  validateGraph,
  type Exercise,
  type ExerciseGraph,
  type Profile,
  type RawExercise,
} from '@adapt/core';
import { CURATION, DATA_VERSION, HOME_PACK } from '@adapt/data';

const here = dirname(fileURLToPath(import.meta.url));
const dataRoot = resolve(here, '../../../packages/data');
const vendorPath = resolve(dataRoot, 'vendor/free-exercise-db/exercises.json');
const outDir = resolve(dataRoot, 'generated');

const dataset = JSON.parse(readFileSync(vendorPath, 'utf8')) as RawExercise[];
const graph = buildGraph({ version: DATA_VERSION, dataset, homePack: HOME_PACK, curation: CURATION });

// ── Validate ────────────────────────────────────────────────────────────────
const problems = validateGraph(graph);
if (problems.length) {
  console.error(`\n✗ Graph invalid — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}

// ── Write ───────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'graph.json'), JSON.stringify(graph) + '\n');

const sessionGraph: ExerciseGraph = {
  version: graph.version,
  sessionPool: graph.sessionPool,
  exercises: Object.fromEntries(graph.sessionPool.map((id) => [id, graph.exercises[id] as Exercise])),
};
writeFileSync(resolve(outDir, 'session-graph.json'), JSON.stringify(sessionGraph, null, 2) + '\n');

// ── Report ──────────────────────────────────────────────────────────────────
const all = Object.values(graph.exercises);
const fromDataset = all.filter((e) => e.source === 'free-exercise-db');
const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(1)}%`;
const withDown = fromDataset.filter((e) => e.adaptsDownTo).length;
const withSub = fromDataset.filter((e) => e.substituteWith).length;

console.log('\nADAPT adaptation graph');
console.log('======================\n');
console.log(`corpus            ${all.length} exercises  (${fromDataset.length} Free Exercise DB + ${HOME_PACK.length} home pack)`);
console.log(`automatic edges   adaptsDownTo ${withDown}/${fromDataset.length} (${pct(withDown, fromDataset.length)})   substituteWith ${withSub}/${fromDataset.length} (${pct(withSub, fromDataset.length)})`);
console.log(`session pool      ${graph.sessionPool.length} movements, ${selectableIds(graph).length} selectable (the rest are ladder floors)\n`);

// Ladders, hardest first, so a human can eyeball every authored edge.
const pool = graph.sessionPool.map((id) => graph.exercises[id] as Exercise);
const pointedAt = new Set(pool.map((e) => e.adaptsDownTo).filter(Boolean));
const tops = pool.filter((e) => !pointedAt.has(e.id)).sort((a, b) => (a.family ?? '').localeCompare(b.family ?? ''));

console.log('ladders (adaptsDownTo ↓, substituteWith →)');
for (const top of tops) {
  const rungs: string[] = [];
  let cur: Exercise | undefined = top;
  while (cur) {
    const src = cur.source === 'free-exercise-db' ? '·db' : '';
    const sub = cur.substituteWith ? graph.exercises[cur.substituteWith]?.name : '—';
    rungs.push(`${cur.name}${src} ${cur.intensity}  → ${sub}`);
    cur = cur.adaptsDownTo ? graph.exercises[cur.adaptsDownTo] : undefined;
  }
  console.log(`\n  [${top.family}]`);
  rungs.forEach((r, i) => console.log(`   ${i === 0 ? ' ' : '↓'} ${r}`));
}

// What each common single limitation leaves selectable — a sanity check on restrictiveness.
const baseProfile: Profile = {
  trainerId: 'sam',
  ageYears: 34,
  heightCm: 176,
  weightKg: 82,
  injuries: [],
  conditions: [],
  defaultDurationMin: 12,
  intensityPreference: 'steady',
  personalBias: 1,
};
const variants: Array<[string, Partial<Profile>]> = [
  ['no limitations', {}],
  ['knee', { injuries: ['knee'] }],
  ['shoulder', { injuries: ['shoulder'] }],
  ['wrist', { injuries: ['wrist'] }],
  ['ankle', { injuries: ['ankle'] }],
  ['pregnancy', { conditions: ['pregnancy'] }],
  ['heart condition', { conditions: ['heart condition'] }],
];
console.log('\nselectable movements by profile');
for (const [label, patch] of variants) {
  const ok = eligibilityFor({ ...baseProfile, ...patch });
  const names = selectableIds(graph)
    .map((id) => graph.exercises[id] as Exercise)
    .filter(ok)
    .map((e) => e.name);
  console.log(`  ${label.padEnd(16)} ${String(names.length).padStart(2)}  ${names.join(', ')}`);
}

console.log(`\n✓ wrote ${resolve(outDir, 'graph.json')}`);
console.log(`✓ wrote ${resolve(outDir, 'session-graph.json')}\n`);

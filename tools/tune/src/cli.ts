#!/usr/bin/env node
// npm run tune [-- <dir>] [--frames]   scores every recorded trace and exits non-zero if any check fails

import { analyze, type Report } from './analyze.js';
import { FIXTURES_DIR, loadTraces } from '@adapt/data/fixtures';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? FIXTURES_DIR;
const showFrames = args.includes('--frames');

const traces = loadTraces(dir);
if (!traces.length) {
  console.log(`No traces in ${dir}. Record some with the phone (npm run relay:record).`);
  process.exit(0);
}

const bar = (q: number, confidence: number) => (confidence === 0 ? '·' : ' ▁▂▃▄▅▆▇█'[Math.round(q * 8)] ?? '█');

let failed = 0;
for (const { file, trace } of traces) {
  const r: Report = analyze(trace);
  console.log(`\n${trace.name} · ${trace.take} · ${trace.floor} floor · ${r.seconds.toFixed(0)} s · ${trace.device}`);
  console.log(`  ${file}`);
  if (showFrames) console.log(`  ${r.frames.map((f) => bar(f.quality, f.confidence)).join('')}`);
  if (r.cadence !== null && trace.expectedCadence) {
    console.log(`  cadence ${r.cadence.toFixed(0)}/min · expected ${trace.expectedCadence} (${(r.cadence / trace.expectedCadence).toFixed(2)}×)`);
  }
  for (const c of r.checks) {
    if (!c.pass) failed++;
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.name.padEnd(32)} ${c.detail}`);
  }
}

console.log(`\n${traces.length} traces · ${failed ? `${failed} checks failed` : 'all checks pass'}`);
process.exit(failed ? 1 : 0);

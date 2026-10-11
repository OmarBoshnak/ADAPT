#!/usr/bin/env node
// free-exercise-db-graph exercises.json [--stats] > graph.json

import { readFileSync } from 'node:fs';

import { buildGraph, stats } from './graph.js';
import type { RawExercise } from './types.js';

const [input, ...flags] = process.argv.slice(2);
if (!input) {
  console.error('usage: free-exercise-db-graph <exercises.json> [--stats]');
  process.exit(2);
}

const graph = buildGraph(JSON.parse(readFileSync(input, 'utf8')) as RawExercise[]);

if (flags.includes('--stats')) {
  const s = stats(graph);
  const pct = (n: number) => `${((n / s.exercises) * 100).toFixed(1)}%`;
  console.log(`${s.exercises} exercises · step-down edges ${s.withStepDown} (${pct(s.withStepDown)}) · substitutes ${s.withSubstitute} (${pct(s.withSubstitute)})`);
} else {
  process.stdout.write(`${JSON.stringify(graph, null, 2)}\n`);
}

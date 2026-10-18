import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildGraph, type RawExercise } from '@adapt/core';
import { CURATION, DATA_VERSION, HOME_PACK, ILLUSTRATION_CREDIT } from '@adapt/data';

import { buildAllIllustrations, buildIllustrations, framePath } from './illustrations.js';

const data = (path: string) => fileURLToPath(new URL(`../../../packages/data/${path}`, import.meta.url));
const json = (path: string) => JSON.parse(readFileSync(data(path), 'utf8'));

const dataset = json('vendor/free-exercise-db/exercises.json') as RawExercise[];
const graph = buildGraph({ version: DATA_VERSION, dataset, homePack: HOME_PACK, curation: CURATION });
const pool = new Set(graph.sessionPool);

describe('generated files the TV bundles', () => {
  it('session-graph.json matches the sources (run `npm run graph` if not)', () => {
    const fresh = Object.fromEntries(graph.sessionPool.map((id) => [id, graph.exercises[id]]));
    expect(json('generated/session-graph.json').exercises).toEqual(fresh);
  });

  it('illustrations.json matches the stored artwork (run `npm run graph` if not)', () => {
    expect(json('generated/illustrations.json')).toEqual({
      credit: ILLUSTRATION_CREDIT,
      movements: buildAllIllustrations(data(''), pool),
    });
  });
});

describe('illustrations', () => {
  it('draw every movement in the session pool, three frames each', () => {
    const built = buildAllIllustrations(data(''), pool);
    expect(Object.keys(built).sort()).toEqual([...pool].sort());
    for (const ill of Object.values(built)) expect(ill.frames).toHaveLength(3);
    expect(() => buildIllustrations(data('illustrations/workout-guide'), { Not_A_Movement: { slug: 'burpee', frameMs: 500 } }, pool)).toThrow(
      /not in the session pool/,
    );
  });

  it('refuse artwork that is not a single white path on the expected canvas', () => {
    const ok = '<svg viewBox="0 0 512 512"><path fill="#fff" fill-rule="evenodd" d="M0 0h1v1z"/></svg>';
    expect(framePath(ok, 'ok')).toBe('M0 0h1v1z');
    expect(() => framePath(ok.replace('512 512', '256 256'), 'x')).toThrow(/viewBox/);
    expect(() => framePath(ok.replace('</svg>', '<path d="M1 1"/></svg>'), 'x')).toThrow(/one path/);
    expect(() => framePath(ok.replace('#fff', '#000'), 'x')).toThrow(/white/);
  });
});

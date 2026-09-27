/**
 * @adapt/data — the exercise corpus.
 *
 * Two sources, deliberately kept distinguishable:
 *
 *  - vendor/free-exercise-db   Unlicense, public domain, 876 exercises with real
 *                              demonstration photographs. Breadth, metadata, imagery.
 *  - src/home-pack.ts          Authored for ADAPT. The no-equipment rhythmic movements the
 *                              dataset lacks, with hand-authored adaptation edges.
 *
 * `tools/build-graph` combines them into `generated/graph.json` (the whole corpus) and
 * `generated/session-graph.json` (just the session pool, small enough to bundle on a TV).
 */

export { HOME_PACK } from './home-pack.js';
export { CURATION } from './curation.js';

export const DATA_VERSION = '0.2.0';

/** Where exercise photographs live in the upstream repository, keyed by `images[i]`. */
export const DATASET_IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/a859101d633a01c4a1a920d6a8ce41dabba0705f/exercises/';

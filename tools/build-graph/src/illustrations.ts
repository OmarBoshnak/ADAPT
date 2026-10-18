import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FIGURES, ILLUSTRATIONS, type IllustrationSource } from '@adapt/data';

export interface Illustration {
  frameMs: number;
  /** Path data for frames 1–3, each a white even-odd fill on a 512 × 512 canvas. */
  frames: string[];
}

/** The artwork stays as published; this only reads its single path so the TV can draw it without an XML parser. */
export function framePath(svg: string, label: string): string {
  if (!/viewBox="0 0 512 512"/.test(svg)) throw new Error(`${label}: expected a 512 × 512 viewBox`);
  const paths = svg.match(/<path\b[^>]*>/g) ?? [];
  if (paths.length !== 1) throw new Error(`${label}: expected one path, found ${paths.length}`);
  const path = paths[0]!;
  if (!/fill="#fff"/.test(path) || !/fill-rule="evenodd"/.test(path)) throw new Error(`${label}: expected a white even-odd fill`);
  const d = path.match(/\bd="([^"]+)"/)?.[1];
  if (!d) throw new Error(`${label}: path has no data`);
  return d;
}

export function buildIllustrations(
  dir: string,
  sources: Record<string, IllustrationSource>,
  pool: Set<string>,
): Record<string, Illustration> {
  return Object.fromEntries(
    Object.entries(sources).map(([id, { slug, frameMs }]) => {
      if (!pool.has(id)) throw new Error(`illustration for ${id}, which is not in the session pool`);
      const frames = [1, 2, 3].map((i) =>
        framePath(readFileSync(resolve(dir, slug, `frame-${i}.svg`), 'utf8'), `${slug}/frame-${i}`),
      );
      return [id, { frameMs, frames }];
    }),
  );
}

/** The Workout Guide drawings and ADAPT's own figures; a movement may have only one. */
export function buildAllIllustrations(dataRoot: string, pool: Set<string>): Record<string, Illustration> {
  const guide = buildIllustrations(resolve(dataRoot, 'illustrations/workout-guide'), ILLUSTRATIONS, pool);
  const own = buildIllustrations(resolve(dataRoot, 'illustrations/adapt'), FIGURES, pool);
  const twice = Object.keys(own).filter((id) => id in guide);
  if (twice.length) throw new Error(`drawn twice: ${twice.join(', ')}`);
  return { ...guide, ...own };
}

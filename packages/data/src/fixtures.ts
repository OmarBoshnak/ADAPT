import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TraceSchema, type Trace } from '@adapt/core';

// Real floor traces recorded on a phone. Node only; kept out of the package index for that reason.

export const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url));

export function loadTraces(dir = FIXTURES_DIR): Array<{ file: string; trace: Trace }> {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return files.map((file) => ({ file, trace: TraceSchema.parse(JSON.parse(readFileSync(join(dir, file), 'utf8'))) }));
}

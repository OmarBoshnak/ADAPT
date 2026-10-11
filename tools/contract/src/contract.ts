import { fileURLToPath } from 'node:url';

import { COACH_SCHEMAS, COPY_RULES } from '@adapt/core';
import { z } from 'zod';

export const CONTRACT_DIR = fileURLToPath(new URL('../../../services/coach/contract', import.meta.url));

/** Every file the Python service reads, keyed by name. */
export function contractFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [name, schema] of Object.entries(COACH_SCHEMAS)) {
    files[`${name}.schema.json`] = `${JSON.stringify(z.toJSONSchema(schema), null, 2)}\n`;
  }
  files['copy-rules.json'] = `${JSON.stringify(COPY_RULES, null, 2)}\n`;
  return files;
}

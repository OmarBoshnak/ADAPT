import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTRACT_DIR, contractFiles } from './contract.js';

describe('coach contract', () => {
  it.each(Object.entries(contractFiles()))('%s matches the zod schemas (npm run contract to update)', (name, body) => {
    expect(readFileSync(join(CONTRACT_DIR, name), 'utf8')).toBe(body);
  });
});

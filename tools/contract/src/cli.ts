#!/usr/bin/env node
// npm run contract   regenerates services/coach/contract from the zod schemas in @adapt/core

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONTRACT_DIR, contractFiles } from './contract.js';

mkdirSync(CONTRACT_DIR, { recursive: true });
for (const [name, body] of Object.entries(contractFiles())) {
  writeFileSync(join(CONTRACT_DIR, name), body);
  console.log(`wrote ${name}`);
}

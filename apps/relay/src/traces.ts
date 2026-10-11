import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { FastifyInstance } from 'fastify';
import { TraceSchema, traceFileName } from '@adapt/core';

const MAX_TRACE_BYTES = 16 * 1024 * 1024;

/** Development only: saves traces recorded on the phone as fixtures for tools/tune. */
export function registerTraces(app: FastifyInstance, dir: string, onSaved?: (file: string) => void): void {
  app.get('/traces', async () => ({ recording: true }));

  app.post('/traces', { bodyLimit: MAX_TRACE_BYTES }, async (req, reply) => {
    const parsed = TraceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ saved: null });
    const file = traceFileName(parsed.data);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, file), JSON.stringify(parsed.data));
    onSaved?.(file);
    return { saved: file };
  });
}

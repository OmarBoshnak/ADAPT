import { randomBytes, randomInt } from 'node:crypto';

import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import { protocol } from '@adapt/core';

import { RoomRegistry, type Conn, type RegistryOptions } from './rooms.js';
import { registerCoach, type CoachClient } from './coach.js';
import { registerTraces } from './traces.js';

export interface RelayOptions {
  host?: string;
  port?: number;
  logger?: boolean;
  sweepMs?: number;
  helloTimeoutMs?: number;
  registry?: RegistryOptions;
  traces?: { dir: string; onSaved?: (file: string) => void };
  coach?: CoachClient | null;
  coachTimeoutMs?: number;
}

export interface Relay {
  app: FastifyInstance;
  registry: RoomRegistry;
  port: number;
  close(): Promise<void>;
}

const WS_OPEN = 1;

export async function startRelay(opts: RelayOptions = {}): Promise<Relay> {
  const registry = new RoomRegistry({
    newCode: (inUse) => {
      for (let i = 0; i < 10_000; i++) {
        const code = String(randomInt(1000, 10_000));
        if (!inUse(code)) return code;
      }
      throw new Error('No free pairing codes');
    },
    newToken: () => randomBytes(18).toString('base64url'),
    ...opts.registry,
  });

  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(websocket, { options: { maxPayload: protocol.MAX_MESSAGE_BYTES } });

  const startedAt = Date.now();
  if (opts.traces) registerTraces(app, opts.traces.dir, opts.traces.onSaved);
  registerCoach(app, opts.coach ?? null, opts.coachTimeoutMs);

  app.get('/health', async () => ({ ok: true, ...registry.stats(), uptimeSec: Math.round((Date.now() - startedAt) / 1000) }));

  let nextId = 0;
  app.get('/ws', { websocket: true }, (socket, req) => {
    const conn: Conn = {
      id: `c${++nextId}`,
      remote: req.ip,
      send: (text) => {
        if (socket.readyState === WS_OPEN) socket.send(text);
      },
      close: (code, reason) => socket.close(code, reason),
    };

    const helloTimer = setTimeout(() => {
      if (!registry.bound(conn)) socket.close(4003, 'no hello');
    }, opts.helloTimeoutMs ?? 5_000);

    socket.on('message', (data, isBinary) => {
      if (isBinary) return;
      registry.receive(conn, data.toString());
    });
    socket.on('close', (code) => {
      clearTimeout(helloTimer);
      registry.disconnect(conn, code === 1000 || code === 1001);
    });
  });

  const sweep = setInterval(() => registry.sweep(), opts.sweepMs ?? 5_000);
  app.addHook('onClose', async () => clearInterval(sweep));

  await app.listen({ host: opts.host ?? '0.0.0.0', port: opts.port ?? 8787 });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : (opts.port ?? 8787);

  return { app, registry, port, close: () => app.close() };
}

#!/usr/bin/env node

import { networkInterfaces } from 'node:os';

import { FIXTURES_DIR } from '@adapt/data/fixtures';

import { coachFromEnv } from './coach.js';
import { startRelay } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const verbose = process.argv.includes('--verbose');
const stamp = () => new Date().toLocaleTimeString();
const traces = process.argv.includes('--record')
  ? { dir: FIXTURES_DIR, onSaved: (file: string) => console.log(`[${stamp()}] saved trace ${file}`) }
  : undefined;
const coach = coachFromEnv(process.env);

const relay = await startRelay({
  port,
  logger: verbose,
  ...(traces ? { traces } : {}),
  coach,
  registry: {
    onEvent: (e) => {
      if (e.type === 'opened') console.log(`[${stamp()}] room ${e.code} opened`);
      else if (e.type === 'closed') console.log(`[${stamp()}] room ${e.code} closed`);
      else console.log(`[${stamp()}] ${e.role === 'display' ? 'TV' : 'phone'} ${e.type} room ${e.code}`);
    },
  },
});

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((i): i is NonNullable<typeof i> => !!i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

console.log(`\nADAPT relay listening on :${relay.port}\n`);
console.log('Connect with:');
for (const ip of lan) console.log(`  phone on this Wi-Fi      ws://${ip}:${relay.port}/ws`);
console.log(`  Vega Virtual Device      ws://10.0.2.2:${relay.port}/ws   (no setup — QEMU's alias for this machine)`);
console.log(`  Android TV emulator      ws://10.0.2.2:${relay.port}/ws   (same alias)`);
console.log(`  Fire TV over USB         ws://127.0.0.1:${relay.port}/ws  after: vega device start-port-forwarding --port ${relay.port} --forward false`);
console.log(`  this machine             ws://127.0.0.1:${relay.port}/ws`);
console.log(`\nHealth: http://127.0.0.1:${relay.port}/health`);
console.log(traces ? `Recording traces to ${traces.dir}` : '');
console.log(
  process.env.COACH_URL
    ? `Coach: local AgentCore dev server at ${process.env.COACH_URL}\n`
    : process.env.COACH_AGENT_ARN
      ? `Coach: AgentCore Runtime ${process.env.COACH_AGENT_ARN}\n`
      : 'Coach: off — the TV plans locally (set COACH_AGENT_ARN or COACH_URL)\n',
);

const shutdown = async () => {
  await relay.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

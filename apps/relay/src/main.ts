#!/usr/bin/env node
/**
 * adapt-relay — run on the development machine during development and filming.
 *
 *   npm run relay
 *   PORT=9000 npm run relay
 */

import { networkInterfaces } from 'node:os';

import { startRelay } from './server.js';

const port = Number(process.env.PORT ?? 8787);
const verbose = process.argv.includes('--verbose');

const relay = await startRelay({ port, logger: verbose });

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
console.log(`\nHealth: http://127.0.0.1:${relay.port}/health\n`);

const shutdown = async () => {
  await relay.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * The relay over real sockets, with the real RelayClient on both ends — exactly what the TV
 * and the phone will run. Node 22+ provides the same global WebSocket they use.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { RelayClient, type RelayStatus, type protocol } from '@adapt/core';

import { startRelay, type Relay } from './server.js';

let relay: Relay | null = null;
const clients: RelayClient[] = [];

afterEach(async () => {
  for (const c of clients.splice(0)) c.stop();
  await relay?.close();
  relay = null;
});

async function boot(opts: Parameters<typeof startRelay>[0] = {}) {
  relay = await startRelay({ host: '127.0.0.1', port: 0, sweepMs: 200, ...opts });
  return `ws://127.0.0.1:${relay.port}/ws`;
}

function until<T>(check: () => T | undefined | false, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      const v = check();
      if (v) return resolve(v);
      if (Date.now() - started > timeoutMs) return reject(new Error('timed out'));
      setTimeout(poll, 10);
    };
    poll();
  });
}

function connect(url: string, role: 'display' | 'sensor', code?: string) {
  const inbox: protocol.Message[] = [];
  let status: RelayStatus | null = null;
  const c = new RelayClient({
    url,
    role,
    ...(code ? { code } : {}),
    client: `test-${role}`,
    initialBackoffMs: 50,
    maxBackoffMs: 200,
    onMessage: (m) => inbox.push(m),
    onStatus: (s) => (status = s),
  });
  clients.push(c);
  c.start();
  return { c, inbox, status: () => status };
}

describe('relay server', () => {
  it('answers health checks', async () => {
    await boot();
    const res = await fetch(`http://127.0.0.1:${relay!.port}/health`);
    expect(await res.json()).toMatchObject({ ok: true, rooms: 0 });
  });

  it('pairs a TV and a phone and carries a session between them', async () => {
    const url = await boot();
    const tv = connect(url, 'display');
    const code = await until(() => tv.status()?.code ?? undefined);
    expect(code).toMatch(/^\d{4}$/);

    const phone = connect(url, 'sensor', code);
    await until(() => tv.status()?.peer === 'present');
    await until(() => phone.status()?.connection === 'open');

    tv.c.send('session.exercise', { seq: 1, exerciseId: 'adapt_jumping_jacks', name: 'Jumping Jacks', signalProfile: 'impact', expectedCadence: 70, durationSec: 60 });
    await until(() => phone.inbox.find((m) => m.type === 'session.exercise'));

    phone.c.send('sensor.frame', { seq: 1, t: 1, quality: 0.8, cadence: 70, confidence: 1, profile: 'impact' });
    phone.c.send('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' });
    const correction = await until(() => tv.inbox.find((m) => m.type === 'user.correction'));
    expect(correction).toMatchObject({ heard: 'easier' });
    expect(tv.inbox.some((m) => m.type === 'sensor.frame')).toBe(true);
  });

  it('keeps the heartbeat alive across several sweeps', async () => {
    const url = await boot({ registry: { silenceMs: 600 } });
    const tv = connect(url, 'display');
    const code = await until(() => tv.status()?.code ?? undefined);
    const phone = connect(url, 'sensor', code);
    await until(() => tv.status()?.peer === 'present');
    await new Promise((r) => setTimeout(r, 1500)); // > 2× the silence window
    expect(tv.status()?.peer).toBe('present');
    expect(phone.status()?.connection).toBe('open');
  });

  it('tells the TV when the phone drops, and lets the phone reclaim its seat', async () => {
    const url = await boot();
    const tv = connect(url, 'display');
    const code = await until(() => tv.status()?.code ?? undefined);
    const phone = connect(url, 'sensor', code);
    await until(() => tv.status()?.peer === 'present');

    // Kill the phone's socket out from under it, as a Wi-Fi blip would.
    const raw = (phone.c as unknown as { socket: { close(c: number): void } }).socket;
    raw.close(4999);
    await until(() => tv.inbox.find((m) => m.type === 'peer' && m.status === 'lost'));

    await until(() => tv.status()?.peer === 'present'); // it came back on its own
    expect(phone.status()?.code).toBe(code);
  });

  it('rejects a wrong code without retrying', async () => {
    const url = await boot();
    const phone = connect(url, 'sensor', '1234');
    await until(() => phone.status()?.connection === 'rejected');
    expect(phone.status()?.rejectedReason).toBe('unknown-code');
  });

  it('closes a connection that never says hello', async () => {
    const url = await boot({ helloTimeoutMs: 100 });
    const ws = new WebSocket(url);
    const code = await new Promise<number>((resolve) => ws.addEventListener('close', (e) => resolve(e.code)));
    expect(code).toBe(4003);
  });
});

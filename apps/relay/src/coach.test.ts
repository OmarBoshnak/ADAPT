import { afterEach, describe, expect, it } from 'vitest';

import type { CoachCall, CoachClient } from './coach.js';
import { startRelay, type Relay } from './server.js';

let relay: Relay | null = null;

afterEach(async () => {
  await relay?.close();
  relay = null;
});

const planRequest = {
  task: 'plan',
  minutes: 12,
  energy: 'medium',
  count: 2,
  targetIntensity: { min: 4, max: 6 },
  candidates: [{ id: 'adapt_jumping_jacks', name: 'Jumping Jacks', intensity: 6, family: 'jacks', signal: 'impact' }],
};

function fakeCoach(answer: (payload: unknown, signal: AbortSignal) => Promise<unknown>) {
  const seen: unknown[] = [];
  const coach: CoachClient = {
    invoke: (payload, signal) => {
      seen.push(payload);
      return answer(payload, signal);
    },
  };
  return { coach, seen };
}

async function post(body: unknown) {
  return relay!.app.inject({ method: 'POST', url: '/coach', payload: body as object });
}

describe('relay coach proxy', () => {
  it('says plainly when no coach is configured, so the TV falls back at once', async () => {
    relay = await startRelay({ host: '127.0.0.1', port: 0 });
    expect((await post(planRequest)).statusCode).toBe(503);
  });

  it('forwards only coach requests, never arbitrary payloads', async () => {
    const { coach, seen } = fakeCoach(async () => ({ ok: true }));
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach });
    seen.length = 0;
    const res = await post({ task: 'plan', profile: { injuries: ['knee'] } });
    expect(res.statusCode).toBe(400);
    expect(seen).toEqual([]);
  });

  it('passes a valid request through and returns the answer as given', async () => {
    const answer = { exerciseIds: ['adapt_jumping_jacks'], title: 'Reset', rationale: 'r' };
    const { coach, seen } = fakeCoach(async (p) => ((p as { task: string }).task === 'ping' ? { ok: true } : answer));
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach });
    const res = await post(planRequest);
    expect(res.json()).toEqual(answer);
    expect(seen).toContainEqual(planRequest);
  });

  it('reports a coach refusal and a coach that is too slow', async () => {
    const { coach } = fakeCoach(async (p) => {
      if ((p as { task: string }).task === 'ping') return { ok: true };
      return { error: 'rejected' };
    });
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach });
    expect((await post(planRequest)).statusCode).toBe(502);
    await relay.close();

    const slow = fakeCoach(
      (_p, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
    );
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach: slow.coach, coachTimeoutMs: 50 });
    expect((await post(planRequest)).statusCode).toBe(504);
  });

  it('reports every call, with the reason when it did not answer', async () => {
    const calls: CoachCall[] = [];
    const { coach } = fakeCoach(async (p) => {
      if ((p as { task: string }).task === 'ping') return { ok: true };
      throw new Error('ThrottlingException');
    });
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach, onCoachCall: (c) => calls.push(c) });
    await post(planRequest);
    expect(calls).toEqual([expect.objectContaining({ task: 'plan', outcome: 'failed', detail: 'Error: ThrottlingException' })]);
  });

  it('holds the first call until the warm-up has started the runtime', async () => {
    const order: string[] = [];
    let started = () => {};
    const { coach } = fakeCoach(async (p) => {
      const { task } = p as { task: string };
      if (task === 'ping') {
        await new Promise<void>((resolve) => (started = resolve));
        order.push('warm');
        return { ok: true };
      }
      order.push(task);
      return { exerciseIds: ['adapt_jumping_jacks'], title: 'Reset', rationale: 'r' };
    });
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach });
    const res = post(planRequest);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual([]);
    started();
    expect((await res).statusCode).toBe(200);
    expect(order).toEqual(['warm', 'plan']);
  });

  it('keeps the coach warm', async () => {
    const { coach, seen } = fakeCoach(async () => ({ ok: true }));
    relay = await startRelay({ host: '127.0.0.1', port: 0, coach });
    expect(seen).toContainEqual({ task: 'ping' });
  });
});

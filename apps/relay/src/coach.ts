import { randomBytes } from 'node:crypto';

import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import type { FastifyInstance } from 'fastify';
import { CoachNarrativeRequestSchema, CoachPlanRequestSchema } from '@adapt/core';
import { z } from 'zod';

const RequestSchema = z.discriminatedUnion('task', [CoachPlanRequestSchema, CoachNarrativeRequestSchema]);

const TIMEOUT_MS = 3800;
const WARM_EVERY_MS = 10 * 60_000;

export interface CoachClient {
  invoke(payload: unknown, signal: AbortSignal): Promise<unknown>;
}

/** The AgentCore dev server, `uv run python -m coach.app`. */
export function httpCoach(baseUrl: string): CoachClient {
  return {
    async invoke(payload, signal) {
      const res = await fetch(`${baseUrl}/invocations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok) throw new Error(`coach answered ${res.status}`);
      return res.json();
    },
  };
}

/** The deployed AgentCore Runtime. One session id per relay, so pings keep the same instance warm. */
export function agentCoreCoach(agentRuntimeArn: string, region: string): CoachClient {
  const client = new BedrockAgentCoreClient({ region });
  const runtimeSessionId = `adapt-relay-${randomBytes(16).toString('hex')}`;
  return {
    async invoke(payload, signal) {
      const out = await client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn,
          runtimeSessionId,
          contentType: 'application/json',
          payload: new TextEncoder().encode(JSON.stringify(payload)),
        }),
        { abortSignal: signal },
      );
      return JSON.parse((await out.response?.transformToString()) ?? 'null');
    },
  };
}

export function coachFromEnv(env: NodeJS.ProcessEnv): CoachClient | null {
  if (env.COACH_URL) return httpCoach(env.COACH_URL);
  if (env.COACH_AGENT_ARN) return agentCoreCoach(env.COACH_AGENT_ARN, env.AWS_REGION ?? 'us-east-1');
  return null;
}

/** Forwards contract-valid coach requests only; the TV validates every reply against the strain model. */
export function registerCoach(app: FastifyInstance, coach: CoachClient | null, timeoutMs = TIMEOUT_MS): void {
  app.post('/coach', async (req, reply) => {
    if (!coach) return reply.code(503).send({ error: 'no coach configured' });
    const parsed = RequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'not a coach request' });

    try {
      const answer = await coach.invoke(parsed.data, AbortSignal.timeout(timeoutMs));
      if (answer && typeof answer === 'object' && 'error' in answer) return reply.code(502).send(answer);
      return answer;
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
      return reply.code(timedOut ? 504 : 502).send({ error: timedOut ? 'coach timed out' : 'coach unavailable' });
    }
  });

  if (!coach) return;
  const warm = () => coach.invoke({ task: 'ping' }, AbortSignal.timeout(30_000)).catch(() => {});
  void warm();
  const timer = setInterval(warm, WARM_EVERY_MS);
  app.addHook('onClose', async () => clearInterval(timer));
}

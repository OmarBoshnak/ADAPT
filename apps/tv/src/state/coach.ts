import {config} from '~/config';

const coachUrl = `${config.relayUrl.replace(/^ws/, 'http').replace(/\/ws$/, '')}/coach`;
const ANSWER_LIMIT_MS = 20_000;

let early: {key: string; answer: Promise<unknown | null>} | null = null;

function post(request: unknown): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANSWER_LIMIT_MS);
  return fetch(coachUrl, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));
}

/** Starts a question before it is needed, so the answer can already be there when `askCoach` asks it. */
export function askCoachEarly(request: unknown): void {
  const key = JSON.stringify(request);
  if (early?.key !== key) early = {key, answer: post(request)};
}

/** Asks the cloud coach through the relay. Resolves null on any failure, and always by the deadline. */
export function askCoach(request: unknown, timeoutMs = config.coachTimeoutMs): Promise<unknown | null> {
  const key = JSON.stringify(request);
  const answer = early?.key === key ? early.answer : post(request);
  early = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([answer, deadline]).finally(() => timer && clearTimeout(timer));
}

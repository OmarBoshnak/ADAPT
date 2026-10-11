import {config} from '~/config';

const coachUrl = `${config.relayUrl.replace(/^ws/, 'http').replace(/\/ws$/, '')}/coach`;

/** Asks the cloud coach through the relay. Resolves null on any failure, and always by the deadline. */
export function askCoach(request: unknown, timeoutMs = config.coachTimeoutMs): Promise<unknown | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const answer = fetch(coachUrl, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(res => (res.ok ? res.json() : null))
    .catch(() => null);
  return Promise.race([answer, deadline]).finally(() => timer && clearTimeout(timer));
}

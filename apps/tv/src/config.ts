export const config = {
  relayUrl: 'ws://10.0.2.2:8787/ws',
  /** Pin a plan seed so a filmed session can be reproduced; plans are then local, not the coach's. Null generates fresh plans. */
  demoSeed: null as number | null,
  /** How long Generate and the summary wait for the coach before using the local plan and the built-in line. */
  coachTimeoutMs: 4000,
};

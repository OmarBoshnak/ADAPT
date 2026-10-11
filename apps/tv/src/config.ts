export const config = {
  relayUrl: 'ws://10.0.2.2:8787/ws',
  /** Pin a plan seed so a filmed session can be reproduced; plans are then local, not the coach's. Null generates fresh plans. */
  demoSeed: null as number | null,
  /** After this, the session uses the locally generated plan and the built-in summary line. */
  coachTimeoutMs: 4000,
};

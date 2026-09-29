import { describe, expect, it } from 'vitest';

import { decode, encode, FORWARDABLE, make, MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from './protocol.js';

describe('protocol', () => {
  it('round-trips every message a peer can send', () => {
    const messages = [
      make('session.exercise', { seq: 3, exerciseId: 'adapt_jumping_jacks', name: 'Jumping Jacks', signalProfile: 'impact', expectedCadence: 70, durationSec: 90 }),
      make('session.state', { seq: 3, phase: 'active' }),
      make('session.adapted', { seq: 3, from: 'Jumping Jacks', to: 'Step Jacks', trigger: 'predicted-strain', reason: 'x' }),
      make('sensor.frame', { seq: 3, t: 12.5, quality: 0.8, cadence: 68, confidence: 1, profile: 'impact' }),
      make('user.correction', { direction: 'easier', source: 'voice', heard: 'easier' }),
      make('user.command', { command: 'swap', source: 'voice', heard: 'swap this' }),
      make('sensor.status', { onFloor: true }),
    ];
    for (const m of messages) {
      const d = decode(encode(m));
      expect(d).toEqual({ ok: true, message: m });
    }
  });

  it('stamps the version on everything it makes', () => {
    expect(make('ping', { t: 1 }).v).toBe(PROTOCOL_VERSION);
  });

  it('rejects malformed, oversized, unknown and future-version input without throwing', () => {
    expect(decode('{not json')).toEqual({ ok: false, reason: 'not-json' });
    expect(decode('x'.repeat(MAX_MESSAGE_BYTES + 1))).toEqual({ ok: false, reason: 'too-large' });
    expect(decode(JSON.stringify({ v: 1, type: 'launch.missiles' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(decode(JSON.stringify({ v: 2, type: 'ping', t: 1 }))).toEqual({ ok: false, reason: 'version' });
  });

  it('rejects out-of-range values', () => {
    const bad = { v: 1, type: 'sensor.frame', seq: 1, t: 1, quality: 1.5, cadence: null, confidence: 1, profile: 'impact' };
    expect(decode(JSON.stringify(bad)).ok).toBe(false);
    expect(decode(JSON.stringify({ v: 1, type: 'hello', role: 'sensor', code: '12a4', client: 'x' })).ok).toBe(false);
  });

  it('strips fields it does not know, so only validated data travels on', () => {
    const d = decode(JSON.stringify({ v: 1, type: 'sensor.status', onFloor: true, secret: 'x' }));
    expect(d.ok && d.message).toEqual({ v: 1, type: 'sensor.status', onFloor: true });
  });

  it('lets each role forward only its own messages', () => {
    expect(FORWARDABLE.display.has('session.exercise')).toBe(true);
    expect(FORWARDABLE.display.has('sensor.frame')).toBe(false);
    expect(FORWARDABLE.sensor.has('user.correction')).toBe(true);
    expect(FORWARDABLE.sensor.has('user.command')).toBe(true);
    expect(FORWARDABLE.sensor.has('session.exercise')).toBe(false);
    for (const role of ['display', 'sensor'] as const) {
      for (const control of ['hello', 'welcome', 'rejected', 'peer', 'ping', 'pong'] as const) {
        expect(FORWARDABLE[role].has(control)).toBe(false);
      }
    }
  });
});

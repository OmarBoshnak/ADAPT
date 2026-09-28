/**
 * @adapt/core — the ADAPT engine.
 *
 * Platform-agnostic by contract. This package must never import from react-native, expo,
 * or node:* — the ESLint rule in eslint.config.js enforces it. That purity is what lets a
 * full session be simulated in milliseconds with no emulator, and what makes the Fire OS
 * fallback and the Vega app share one engine.
 */

export * from './types.js';
export * from './random.js';
export * from './text.js';
export * from './intensity.js';
export * from './graph.js';
export * from './contraindications.js';
export * from './strain.js';
export * from './learning.js';
export * from './signal.js';
export * from './synth.js';
export * from './generator.js';
export * from './session.js';
export * as protocol from './protocol.js';
export * from './relay-client.js';
export * from './live.js';

/**
 * @adapt/core — the ADAPT engine.
 *
 * Platform-agnostic by contract. This package must never import from react-native,
 * expo, or node:* — the ESLint rule in eslint.config.js enforces it. That purity is
 * what lets a full session be simulated in milliseconds with no emulator, and what
 * makes a future Vega OS port a view-layer swap rather than a rewrite.
 */

export * from './types.js';

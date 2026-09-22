// @ts-check
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

/**
 * Packages that must never appear in `packages/core`.
 *
 * The strain engine is the product's moat. Keeping it free of platform imports is
 * what lets us (a) unit-test a full session in milliseconds with no emulator, and
 * (b) port the TV app to Vega OS as a view-layer swap rather than a rewrite.
 * This rule is the enforcement, not a convention.
 */
const PLATFORM_MODULES = [
  'react',
  'react-native',
  'react-native-tvos',
  'react-dom',
  'expo',
  'fs',
  'path',
  'os',
  'crypto',
  'http',
  'https',
  'net',
  'ws',
  'fastify',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'packages/data/vendor/**',
      'packages/data/dist/**',
      'apps/tv/android/**',
      'apps/tv/ios/**',
      'apps/phone/.expo/**',
      // React Native ships its build config as CommonJS scripts. They are tooling,
      // not product code, and linting them under the ESM config is pure noise.
      '**/babel.config.js',
      '**/metro.config.js',
      '**/jest.config.js',
      '**/react-native.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': 'off',
    },
  },

  // ---- The core purity guard -------------------------------------------------
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: PLATFORM_MODULES.map((name) => ({
            name,
            message:
              'packages/core must stay platform-agnostic. Only `zod` and relative imports are allowed. ' +
              'Move platform code into apps/* and pass plain data into core.',
          })),
          patterns: [
            {
              group: ['node:*', 'expo-*', 'react-native-*', '@react-native*'],
              message:
                'packages/core must stay platform-agnostic. Only `zod` and relative imports are allowed.',
            },
          ],
        },
      ],
    },
  },

  // ---- The safety guard ------------------------------------------------------
  // The design spec is explicit: the interface never evaluates a body or interprets
  // a condition. A wrong sentence here is a real problem, not a design flaw — so it
  // fails the build rather than relying on review.
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Literal[value=/\\b(BMI|body mass index|overweight|obese|obesity|calories? burned|calorie target)\\b/i]",
          message:
            'ADAPT never evaluates or judges the user’s body. Height and weight are inputs for ' +
            'movement selection only and are never shown back as an assessment.',
        },
      ],
    },
  },
);

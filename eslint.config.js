// @ts-check
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

// Keeps the engine testable without a device and portable across TV platforms.
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
      'apps/tv-fireos/android/**',
      'apps/tv-fireos/ios/**',
      'apps/phone/.expo/**',
      // React Native build configs are CommonJS tooling.
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

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/relay/**/*.test.ts', 'tools/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/core/src/**'],
      // The engine is the only thing that MUST be correct. Hold it to a real bar.
      thresholds: {
        'packages/core/src/strain.ts': { lines: 85, functions: 85, branches: 75 },
        'packages/core/src/learning.ts': { lines: 85, functions: 85, branches: 75 },
        'packages/core/src/signal.ts': { lines: 85, functions: 85, branches: 75 },
        'packages/core/src/contraindications.ts': { lines: 85, functions: 85, branches: 75 },
      },
    },
  },
});

// Vitest configuration — SENTRY server package
// Environment : node  (no DOM)
// Coverage    : @vitest/coverage-v8  (`npm run test:coverage`)
// Test files  : src/**/*.test.ts  and  tests/**/*.test.ts
// Setup file  : tests/setup.ts — sets NODE_ENV + JWT secrets before each test file
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
});

// Vitest configuration — SENTRY client package
// Environment : jsdom  (simulates browser APIs for React component tests)
// Coverage    : @vitest/coverage-v8  (`npm run test:coverage`)
// Test files  : src/**/*.test.{ts,tsx}  and  tests/**/*.test.{ts,tsx}
// Setup file  : tests/setup.ts — mounts @testing-library/jest-dom matchers + browser API mocks
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
});

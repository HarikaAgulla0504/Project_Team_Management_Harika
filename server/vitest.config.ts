import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Tests share one real database, so test files must run one after another.
    fileParallelism: false,
    testTimeout: 20000,
  },
});

import { defineConfig } from 'vitest/config';

// A dedicated config avoids application setup, dotenv loading and external services.
export default defineConfig({
  test: {
    include: [
      'tests/unit/evaluation/production-contract.test.ts',
      'tests/unit/evaluation/eval-qualification.test.ts',
    ],
    environment: 'node',
    testTimeout: 5000,
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      // Legacy test files without proper describe/it structure
      'src/core/alerts/__tests__/pipeline.test.ts',
      'src/core/alerts/__tests__/full_pipeline.test.ts',
      'src/core/wallets/__tests__/wallet_profile.test.ts'
    ],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'dist/']
    }
  }
});

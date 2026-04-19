import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@drr/shared': resolve(root, 'packages/shared/src/index.ts'),
      '@drr/parsers': resolve(root, 'packages/parsers/src/index.ts'),
      '@drr/providers': resolve(root, 'packages/providers/src/index.ts'),
      '@drr/scoring': resolve(root, 'packages/scoring/src/index.ts'),
      '@drr/policy': resolve(root, 'packages/policy/src/index.ts'),
      '@drr/reporters': resolve(root, 'packages/reporters/src/index.ts'),
      '@drr/core': resolve(root, 'packages/core/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});

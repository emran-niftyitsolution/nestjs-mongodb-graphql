import { defineConfig } from 'vitest/config';

/**
 * E2E tests import `../dist/*` (built with `nest build`).
 * The Nest GraphQL code-first **compiler plugin** (see `nest-cli.json`)
 * only runs in the Nest build pipeline, not in Vitest’s test transform — so tests must not load GraphQL
 * from raw `src/` for a full `AppModule` bootstrap.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/vitest.setup.ts'],
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    testTimeout: 30_000,
  },
});

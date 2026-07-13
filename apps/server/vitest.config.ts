import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tsc compiles src/__tests__ into dist/, and Vitest's default include
    // picks the compiled copies up — every test would run twice, and stale
    // compiled tests for deleted sources would keep running (and failing)
    // until a dist clean.
    exclude: [...configDefaults.exclude, '**/dist/**'],
  },
});

import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    dts: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
    deps: {
      onlyBundle: false,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
  fmt: {
    ignorePatterns: [],
  },
  lint: {
    ignorePatterns: [],
  },
});

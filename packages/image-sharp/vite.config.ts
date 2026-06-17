import { defineConfig } from 'vite-plus';

/**
 * `vite-plus` build config for `pnpm pack` / CI publishing.
 * Local dev + typecheck use `tsgo` (see package.json#scripts.build).
 */
export default defineConfig({
  pack: {
    dts: true,
    format: ['esm', 'cjs'],
    sourcemap: true,
    deps: {
      onlyBundle: false,
    },
  },
});

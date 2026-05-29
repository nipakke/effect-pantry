# @effect-pantry/events

## 0.1.0

### Minor Changes

- [#16](https://github.com/nipakke/effect-pantry/pull/16) [`2f33b05`](https://github.com/nipakke/effect-pantry/commit/2f33b05d9b6284b41c3d2887458aae867ff28a77) Thanks [@nipakke](https://github.com/nipakke)! - Convert namespace re-exports to flat named exports

  Replaces `export * as X from './module.js'` with individual named exports
  throughout all packages. This fixes declaration emit in consumers — TypeScript
  can now write clean package-level type references (e.g. `import type { Storage }
from "@effect-pantry/storage"`) instead of falling back to deep `node_modules`
  paths which are not portable.

  Also adds the early-stage warning JSDoc to `events` and `watch-fs` packages,
  and disables sourcemap/declarationMap generation in dist output (build
  tsconfig only — test configs retain sourcemaps for debugging).

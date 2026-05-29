---
'@effect-pantry/storage': minor
'@effect-pantry/events': minor
---

Convert namespace re-exports to flat named exports

Replaces `export * as X from './module.js'` with individual named exports
throughout all packages. This fixes declaration emit in consumers — TypeScript
can now write clean package-level type references (e.g. `import type { Storage }
from "@effect-pantry/storage"`) instead of falling back to deep `node_modules`
paths which are not portable.

Also adds the early-stage warning JSDoc to `events` and `watch-fs` packages,
and disables sourcemap/declarationMap generation in dist output (build
tsconfig only — test configs retain sourcemaps for debugging).

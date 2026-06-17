# @effect-pantry/storage

## 0.2.0

### Minor Changes

- [#21](https://github.com/nipakke/effect-pantry/pull/21) [`ad40d1e`](https://github.com/nipakke/effect-pantry/commit/ad40d1e1b61f9b9ebf73a6bc3d605124e5652375) Thanks [@nipakke](https://github.com/nipakke)! - Upgrade `files-sdk` peer dependency from `^1.6.0` to `^1.9.0`

  **New features:**

  - `search(pattern, opts?)` — find objects by glob, regex, substring, or exact match (returns `Stream<StoredFile, StorageError>`)
  - `capabilities` — query adapter features at runtime (`rangeRead`, `signedUrl`, `multipart`, etc.)
  - `sync(source, dest, opts?)` — incremental mirror of two `FilesSDK.Files` instances, with prune and dry-run support
  - `readonly`, `receipts`, `plugins` passthrough in `MakeOptions`
  - `multipart`, `control` (resumable), `cacheControl` passthrough in `UploadOptions`

  **Potential breaking change:**

  - `StorageReadOnlyError` added to the `StorageError` union type. Downstream code doing exhaustive pattern matching on `StorageError` will need a new handler for the `ReadOnly` code, thrown when a write is attempted on a read-only `Files` instance.

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

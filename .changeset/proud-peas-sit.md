---
'@effect-pantry/storage': minor
---

Upgrade `files-sdk` peer dependency from `^1.6.0` to `^1.8.0`

**New features:**
- `search(pattern, opts?)` — find objects by glob, regex, substring, or exact match (returns `Stream<StoredFile, StorageError>`)
- `capabilities` — query adapter features at runtime (`rangeRead`, `signedUrl`, `multipart`, etc.)
- `sync(source, dest, opts?)` — incremental mirror of two `FilesSDK.Files` instances, with prune and dry-run support
- `readonly`, `receipts`, `plugins` passthrough in `MakeOptions`
- `multipart`, `control` (resumable), `cacheControl` passthrough in `UploadOptions`

**Potential breaking change:**
- `StorageReadOnlyError` added to the `StorageError` union type. Downstream code doing exhaustive pattern matching on `StorageError` will need a new handler for the `ReadOnly` code, thrown when a write is attempted on a read-only `Files` instance.

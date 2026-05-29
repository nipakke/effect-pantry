# @effect-pantry/storage

**Effect-native object storage** — wraps [files-sdk](https://files-sdk.dev) as typed Effect functions. Swap backends by swapping adapters — the API stays the same.

## Installation

```bash
npm install @effect-pantry/storage effect
```

> **`files-sdk` is a peer dependency.** Install your own version and choose which adapters to bring in (e.g., `files-sdk/s3`, `files-sdk/memory`). Targets **Effect v3** and **files-sdk ^1.6.0**.

## Quick Start

```ts
import { memory } from "files-sdk/memory"
import { Storage, StorageAdapter } from "@effect-pantry/storage"
import { Effect, Layer } from "effect"

const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)

const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // Upload
  const { result } = yield* s.upload("data.json", JSON.stringify({ hello: "world" }))

  // Download
  const file = yield* s.download("data.json")
  const text = yield* file.text()

  return text
})

Effect.runPromise(Effect.provide(program, layer))
```

## API Reference

### `Storage.Storage` (Context.Tag)

The service tag. Inject with `yield* Storage.Storage`.

### `StorageAdapter` (Context.Tag)

Provide any `files-sdk` adapter:

```ts
import { s3 } from "files-sdk/s3"

Layer.succeed(StorageAdapter, s3({
  bucket: "my-bucket",
  region: "us-east-1",
}))
```

### `Storage.layer`

Creates a layer that requires `StorageAdapter` and provides `Storage.Storage`.
Accepts optional {@link MakeOptions} (e.g. `prefix`, `timeout`, `retries`).

```ts
const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)

// With options
const layerWithPrefix = Storage.layer({ prefix: "app-data/" }).pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)
```

### `Storage.make`

Creates a `Storage` service. Reads the adapter from context.
Accepts optional {@link MakeOptions} forwarded to the underlying
`FilesSDK.Files` constructor.

```ts
const s = yield* Storage.make()
```

With options:

```ts
const s = yield* Storage.make({ prefix: "uploads/", timeout: 30_000 })
```

Or inline:

```ts
const s = yield* Storage.make().pipe(
  Effect.provideService(StorageAdapter, memory()),
)
```

### Methods

| Method | Signature | Returns |
|--------|-----------|---------|
| `upload(key, body, opts?)` | `Effect<{ result, progress }, never>` | Returns `{ result: Effect<UploadResult, StorageError>, progress: Stream<UploadProgress> }`. Consume progress concurrently, then `yield*` the result. |
| `download(key, opts?)` | `Effect<StoredFile, StorageError>` | File with lazy body accessors |
| `head(key, opts?)` | `Effect<StoredFile, StorageError>` | Metadata without the body |
| `exists(key, opts?)` | `Effect<boolean, StorageError>` | Existence check |
| `delete(key, opts?)` | `Effect<void, StorageError>` | Permanent removal |
| `copy(from, to, opts?)` | `Effect<void, StorageError>` | Server-side copy |
| `move(from, to, opts?)` | `Effect<void, StorageError>` | Rename / relocate |
| `list(opts?)` | `Effect<ListResult, StorageError>` | Cursor-paginated listing |
| `url(key, opts?)` | `Effect<string, StorageError>` | Public or signed download URL |
| `file(key)` | `FileHandle` | Key-bound handle for ergonomic single-key ops |
| `signedUploadUrl(key, opts)` | `Effect<SignedUpload, StorageError>` | Presigned upload URL |
| `hookStream(name)` | `Stream<HookEventMap[N]>` | Observable hook events |

### `FileHandle`

A key-bound storage handle. Every method operates on a pre-bound key.

```ts
const avatar = s.file("avatars/abc.png")

// Upload
yield* avatar.upload(body, { contentType: "image/png" })

// Check existence
if (yield* avatar.exists()) {
  const meta = yield* avatar.head()
}

// Copy / move
yield* avatar.copyTo("avatars/abc.bak.png")
yield* avatar.copyFrom("legacy/abc.png")
```

| Method | Equivalent |
|--------|-----------|
| `upload(body, opts?)` | `s.upload(key, body, opts?)` |
| `download(opts?)` | `s.download(key, opts?)` |
| `head(opts?)` | `s.head(key, opts?)` |
| `exists(opts?)` | `s.exists(key, opts?)` |
| `delete(opts?)` | `s.delete(key, opts?)` |
| `url(opts?)` | `s.url(key, opts?)` |
| `signedUploadUrl(opts)` | `s.signedUploadUrl(key, opts)` |
| `copyTo(destKey, opts?)` | `s.copy(key, destKey, opts?)` |
| `copyFrom(srcKey, opts?)` | `s.copy(srcKey, key, opts?)` |

### Errors

All methods return typed, tagged errors:

| Error | Code | When |
|-------|------|------|
| `StorageNotFoundError` | `NotFound` | Key, bucket, or container missing |
| `StorageUnauthorizedError` | `Unauthorized` | Credentials missing, expired, or insufficient |
| `StorageConflictError` | `Conflict` | Precondition failed |
| `StorageProviderError` | `Provider` | Network, throttling, 5xx, timeout, cancellation |

```ts
import { StorageNotFoundError, StorageUnauthorizedError } from "@effect-pantry/storage"

yield* s.download("missing.txt").pipe(
  Effect.catchTags({
    StorageNotFoundError: (e) => Effect.succeed(null),
    StorageUnauthorizedError: (e) => Effect.fail(new Error("Check credentials")),
    StorageConflictError: (e) => Effect.fail(e),
    StorageProviderError: (e) => Effect.fail(e),
  }),
)
```

> Use `toStorageError(error)` to manually map unknown errors into typed `StorageError` values when working outside the `Storage` service.

### Hooks

Observe SDK events as Effect streams:

```ts
const s = yield* Storage.Storage

yield* s.hookStream("onAction").pipe(
  Stream.runForEach((e) => Effect.log(`[${e.status}] ${e.type} ${e.key}`)),
  Effect.forkScoped,
)

yield* s.hookStream("onError").pipe(
  Stream.runForEach((e) => Effect.log(`[${e.error.code}] ${e.key}`)),
  Effect.forkScoped,
)
```

### `transfer(source, dest, opts?)`

Cross-provider migration using `FilesSDK.Files` instances. → [Full example](./examples/04-cross-provider-transfer.ts)

```ts
import { transfer } from "@effect-pantry/storage"
import * as FilesSDK from "files-sdk"
import { s3 } from "files-sdk/s3"
import { r2 } from "files-sdk/r2"

const from = new FilesSDK.Files({ adapter: s3({ bucket: "old", region: "us-east-1" }) })
const to   = new FilesSDK.Files({ adapter: r2({ bucket: "new", accountId: "..." }) })

const { result, progress } = yield* transfer(from, to, { prefix: "uploads/" })
const { transferred, skipped, errors } = yield* result
```

## Examples

- [Basic usage](./examples/01-basic-usage.ts) — Full CRUD with the memory adapter
- [S3 adapter](./examples/02-s3-adapter.ts) — Real S3/R2 configuration patterns
- [Hooks & monitoring](./examples/03-hooks-and-monitoring.ts) — Logging, metrics, alerting
- [Cross-provider transfer](./examples/04-cross-provider-transfer.ts) — S3 → R2 migration with progress
- [Streams & progress](./examples/05-streams-and-progress.ts) — Upload/download progress, cancellation

## License

MIT

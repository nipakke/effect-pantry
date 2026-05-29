# files-sdk Concepts

> Extracted from https://files-sdk.dev

## Bulk Actions

`upload`, `download`, `head`, `exists` each accept an array of keys; `delete` takes one or many. Fans out with bounded concurrency (8 by default). Returns structured results — successes and failures separate, in input order.

| Method | Array returns |
|--------|--------------|
| `upload(items)` | `{ uploaded, errors? }` |
| `download(keys)` | `{ downloaded, errors? }` |
| `head(keys)` | `{ files, errors? }` |
| `exists(keys)` | `{ existing, missing, errors? }` |
| `delete(keys)` | `{ deleted, errors? }` |

Options: `concurrency?` (default 8), `stopOnError?` (default false)

- **delete** has native bulk on S3 (`DeleteObjects`, batched in 1000s), Supabase, UploadThing. Others fan out.
- **upload/download/head/exists** always fan out.
- Bulk calls are **not retried** — `retries` applies to single-op only.
- **onError** does not fire for bulk partial failures.

## Cancellation

Pass `signal: AbortSignal` to any call. On abort: rejects with `FilesError` carrying `aborted: true`.

```ts
const controller = new AbortController();
const upload = files.upload("key", file, { signal: controller.signal });
controller.abort(); // → FilesError with aborted: true
```

- **Constructor signal** applies to every single-key operation on that instance.
- **Per-call signal** + constructor signal: either abort cancels the call.
- **Array forms** don't take per-call `signal`.
- **Downstream**: Files layer always aborts fast. Whether provider SDK also receives the signal depends on the adapter (S3 family forwards it; UploadThing's `delete` doesn't).

## Retries

Only `Provider` failures are retried. Deterministic codes (`NotFound`, `Unauthorized`, `Conflict`) return immediately.

```ts
// Shorthand
const files = new Files({ adapter, retries: 3 });

// Full
const files = new Files({
  adapter,
  retries: { max: 3, backoff: ({ attempt }) => attempt * 500 },
});
```

**Not retried**: `NotFound` / `Unauthorized` / `Conflict`, aborts, timeouts, `ReadableStream` uploads (stream consumed), bulk operations.

**Backoff**: Default exponential `100 * 2^(attempt-1)` ms, capped at 30s, no jitter. Override with custom `backoff({ attempt, error })`.

## Timeouts

`timeout` caps per-attempt duration (ms). On fire → abort + `code: "Provider"`, `aborted: true`. Not retried.

```ts
const files = new Files({ adapter, timeout: 10_000 });
await files.head("key", { timeout: 2_000 }); // per-call wins
```

- **Per attempt, not per call**: Each retry attempt gets a fresh timeout.
- **Adapter timeouts** (Vercel Blob, UploadThing) merge — whichever fires first wins.

## Multipart Uploads

Splits body into parts, uploads in parallel, stitches server-side. A per-call option on `upload` only.

```ts
await files.upload("big.zip", stream, { multipart: true });
// or tuned:
await files.upload("big.zip", stream, {
  multipart: { partSize: 16 * 1024 * 1024, concurrency: 8 },
});
```

| Adapter | Behavior |
|---------|----------|
| S3 family | Via `@aws-sdk/lib-storage` (optional peer dep); auto for unknown-length streams |
| OneDrive | Chunked upload session above 250MB |
| GCS / Firebase | Resumable upload |
| Azure | Tunes existing parallel block upload |
| Dropbox | Streams chunk-by-chunk via upload session |
| Others | Ignored (already streaming or buffered-only) |

**Sizing**: `partSize × concurrency` bytes buffered at once. Defaults: 5 MiB × 4. S3 caps objects at 10,000 parts — size accordingly.

## Prefixes

Constructor `prefix` namespaces every key. Prepended on way in, stripped on way out. Slashes normalized. Never leaks to caller-facing results or hooks.

```ts
const users = new Files({ adapter: s3({ bucket }), prefix: "users" });
await users.upload("123/avatar.png", file); // writes users/123/avatar.png
stored.key; // "123/avatar.png" — prefix stripped
```

- `list()` scopes to prefix with path-boundary matching
- Hooks report caller-facing keys, never the prefixed path

## Escape Hatch

`files.raw` gives typed access to the underlying provider client (`S3Client`, `VercelBlobClient`, etc.) for features outside the unified surface (versioning, ACLs, lifecycle rules).

```ts
const files = new Files({ adapter: s3({ bucket }) });
await files.raw.send(new PutObjectAclCommand({ ... })); // typed as S3Client
```

Bypasses: prefix scoping, normalized errors, hooks, retries, timeouts, cancellation. An unmanaged door straight to the provider.

## Transfer

Cross-provider migration: walks every object under a prefix from one `Files` instance to another.

> **@effect-pantry/storage note:** The `transfer` wrapper in `@effect-pantry/storage`
> manages `onProgress` internally and returns `{ result, progress }` where `progress` is
> an Effect `Stream<TransferProgress>`. `onProgress` is never part of the options type.

```ts
import { Files, transfer } from "files-sdk";
const from = new Files({ adapter: s3({ bucket: "old" }) });
const to = new Files({ adapter: r2({ bucket: "new", ... }) });

const { transferred, skipped, errors } = await transfer(from, to, {
  prefix: "uploads/",
  transformKey: (key) => `archive/${key}`,
  overwrite: false,
  concurrency: 16,
  onProgress: ({ done, key, status }) => {},
});
```

**Using `@effect-pantry/storage` instead:**

```ts
const { result, progress } = yield* transfer(from, to, { prefix: "uploads/" });
yield* Stream.runForEach(progress, (p) =>
  Effect.log(`${p.status} ${p.key} (${p.done}/${p.total})`)
).pipe(Effect.forkScoped);
const { transferred, skipped, errors } = yield* result;
```

- Each leg honors its own instance's prefix, retries, timeouts, hooks
- Objects streamed download-to-upload — never buffered
- `overwrite: false` costs one extra `exists()` per key
- Partial failure: `errors` collected, never throws on partial

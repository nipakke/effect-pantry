# files-sdk Hooks

> Extracted from https://files-sdk.dev

Three constructor hooks (`onAction`, `onError`, `onRetry`) plus a per-call upload callback (`onProgress`). All are **fire-and-forget** — the SDK calls them but never awaits them, and throwing can't fail the operation.

## Events

```ts
const files = new Files({
  adapter: s3({ bucket: "uploads" }),
  hooks: {
    onAction(event) { },
    onError(event) { },
    onRetry(event) { },
  },
});
```

### onAction

Fires once when **any** public call settles (success or failure). For audit logs, activity feeds, and per-action metrics.

| Property | Type | Description |
|----------|------|-------------|
| `type` | `FilesActionType` | Method name: `"upload"`, `"download"`, `"copy"`, etc. |
| `status` | `"success"` \| `"error"` | How the call settled |
| `key?` | `string` | Single-key calls |
| `keys?` | `string[]` | Array-form calls (fires once for the whole batch) |
| `from?` / `to?` | `string` | `copy` and `move` operations |
| `result?` | `unknown` | Resolved value on success |
| `error?` | `FilesError` | Error on failure |
| `durationMs` | `number` | Wall-clock duration |

```ts
hooks: {
  onAction({ type, status, durationMs, key }) {
    logger.info("files", { action: type, status, target: key, ms: durationMs });
  },
}
```

### onError

Fires only when a call **rejects** — just before `onAction({ status: "error" })`. Wire to Sentry/Datadog for true call failures. Not fired for bulk partial failures (those are in `result.errors`).

| Property | Type |
|----------|------|
| `type` | `FilesActionType` |
| `key?` / `keys?` / `from?` / `to?` | Caller-facing target |
| `error` | `FilesError` (always present) |
| `durationMs` | `number` |

Filter aborts (cancellations/timeouts = noise):

```ts
hooks: {
  onError(event) {
    if (event.error.aborted) return; // expected
    Sentry.captureException(event.error, { tags: { action: event.type } });
  },
}
```

### onRetry

Fires each time the SDK schedules a retry for a single-operation call. Never fires on first attempt, for non-retryable errors, for stream uploads, or for bulk/array forms.

| Property | Type |
|----------|------|
| `type` | `FilesActionType` |
| `key?` / `from?` / `to?` | Target key |
| `attempt` | `number` (1-based, counts up) |
| `maxRetries` | `number` |
| `delayMs` | `number` (backoff before next attempt) |
| `error` | `FilesError` (retryable Provider failure) |

Exhaustion detection: `attempt === maxRetries` is the last retry.

```ts
hooks: {
  onRetry(event) {
    metrics.increment("files.retry", { action: event.type });
    if (event.attempt === event.maxRetries) {
      metrics.increment("files.retry.exhausted", { action: event.type });
    }
  },
}
```

### onProgress

Per-call upload callback (not a constructor hook). Fire-and-forget like hooks.

> **@effect-pantry/storage note:** The `Storage.upload` wrapper converts this callback to an
> Effect `Stream` — `onProgress` is handled internally and never exposed in the options.
> Callers receive `{ result, progress }` where `progress` is a
> `Stream<UploadProgress>` consumed concurrently with the result.

```ts
await files.upload("big.zip", stream, {
  onProgress({ loaded, total }) {
    const pct = total ? Math.round((loaded / total) * 100) : null;
  },
});
```

**Using `@effect-pantry/storage` instead:**

```ts
const { result, progress } = yield* svc.upload("big.zip", stream);
yield* Stream.runForEach(progress, (p) => Effect.log(p)).pipe(Effect.forkScoped);
const uploadResult = yield* result;
```

| Property | Type | Description |
|----------|------|-------------|
| `loaded` | `number` | Bytes sent so far |
| `total?` | `number` | Omitted for `ReadableStream` of unknown length |
| `key?` | `string` | Present in uploadMany |

Granularity:
- **Buffered** (File/Blob/ArrayBuffer/string): `{ loaded: 0, total }` → `{ loaded: total, total }`
- **ReadableStream**: byte-by-byte, `total` omitted when length unknown
- **S3 family + Azure + GCS + Vercel Blob**: true byte-level progress via provider SDK hooks
- **Other adapters**: buffered bodies get start/finish pair only

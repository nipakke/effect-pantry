# files-sdk Error Handling

> Extracted from https://files-sdk.dev/api/errors for use in building `@effect-pantry/files`

## FilesError

Every method throws a single `FilesError`. It collapses dozens of provider-specific error shapes into one type with a small `code` enum, while keeping the original error on `cause`.

```ts
import { FilesError } from "files-sdk";

try {
  await files.download("missing.png");
} catch (err) {
  if (err instanceof FilesError && err.code === "NotFound") {
    return null;
  }
  throw err;
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `"NotFound" \| "Unauthorized" \| "Conflict" \| "Provider"` | Normalized error code |
| `message` | `string` | Human-readable summary from provider |
| `cause` | `unknown` | Original provider error, untouched |
| `aborted` | `boolean` | `true` when failure is from cancellation or timeout |

### Error Codes

| Code | HTTP Mapping | Retryable? | When |
|------|-------------|------------|------|
| `"NotFound"` | 404 | No | Key/bucket/container doesn't exist |
| `"Unauthorized"` | 401, 403 | No | Credentials missing, expired, insufficient |
| `"Conflict"` | 409, 412 | No | Precondition failed (conditional write lost a race) |
| `"Provider"` | Everything else | **Yes** | Network, throttling, 5xx, timeouts, aborts |

Only `"Provider"` failures are retried — the first three are deterministic and returned immediately.

### How codes are assigned

Codes derive from the provider's own error code and HTTP status:
- 404 → `NotFound`
- 401/403 → `Unauthorized`
- 409/412 → `Conflict`
- Everything else → `Provider`

### Timeouts & Cancellation

Both surface as `code: "Provider"` with `aborted: true`. Check `aborted` to distinguish from genuine provider failures.

---

## Errors in Bulk Operations

Array-form methods (`upload([])`, `download([])`, `delete([])`, `head([])`, `exists([])`) don't throw on partial failure. Each resolves to a structured result with per-key failures in `errors[]`:

| Method | Error shape |
|--------|-------------|
| `upload` | `errors: Array<{ key: string, error: FilesError }>` |
| `download` | `errors: Array<{ key: string, error: FilesError }>` |
| `head` | `errors: Array<{ key: string, error: FilesError }>` |
| `exists` | `errors: Array<{ key: string, error: FilesError }>` |
| `delete` | `errors: Array<{ key: string, error: FilesError }>` |

Invalid keys (empty, containing null bytes) are reported in `errors`, never thrown.

One bad key never sinks the whole batch.
Bulk calls are **not retried** — `retries` applies to single-operation calls only.

---

## Effect Wrapper Mapping Strategy

Map each `FilesError.code` to a `Data.TaggedError`:

| FilesError Code | Effect Tagged Error | `_tag` |
|----------------|---------------------|--------|
| `"NotFound"` | `FilesNotFoundError` | `"FilesNotFoundError"` |
| `"Unauthorized"` | `FilesUnauthorizedError` | `"FilesUnauthorizedError"` |
| `"Conflict"` | `FilesConflictError` | `"FilesConflictError"` |
| `"Provider"` | `FilesProviderError` | `"FilesProviderError"` |

Union type: `FilesError = FilesNotFoundError | FilesUnauthorizedError | FilesConflictError | FilesProviderError`

Transformation function extracts `code`, `message`, `cause`, and `aborted` from the SDK's `FilesError`:

```ts
const toFilesError = (error: unknown): FilesError => {
  if (error instanceof SDKFilesError) {
    const msg = error.message;
    const cause = error.cause;
    switch (error.code) {
      case "NotFound":
        return new FilesNotFoundError({ message: msg, cause });
      case "Unauthorized":
        return new FilesUnauthorizedError({ message: msg, cause });
      case "Conflict":
        return new FilesConflictError({ message: msg, cause });
      case "Provider":
        return new FilesProviderError({ message: msg, cause, aborted: error.aborted });
    }
  }
  return new FilesProviderError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
    aborted: false,
  });
};
```

For bulk operations, errors in the result's `errors[]` array get the same transformation applied per-entry.

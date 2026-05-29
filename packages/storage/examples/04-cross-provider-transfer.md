# Cross-Provider Transfer

Migrate objects from one storage backend to another without downloading to disk. `transfer()` streams every object the source exposes straight into the destination.

## S3 to R2 Migration

```ts
import * as FilesSDK from "files-sdk"
import { s3 } from "files-sdk/s3"
import { r2 } from "files-sdk/r2"
import { transfer } from "@effect-pantry/storage"
import { Effect, Stream, Console } from "effect"

const source = new FilesSDK.Files({
  adapter: s3({
    bucket: "old-bucket",
    region: "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }),
  prefix: "uploads/",
})

const dest = new FilesSDK.Files({
  adapter: r2({
    accountId: process.env.CF_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: "new-bucket",
  }),
  prefix: "uploads/",
})
```

## With Progress Tracking

```ts
const program = Effect.gen(function* () {
  const { result, progress } = yield* transfer(source, dest, {
    prefix: "uploads/",
    concurrency: 16,
  })

  // Fork progress stream — runs concurrently with the transfer
  yield* Stream.runForEach(progress, (p) =>
    Effect.gen(function* () {
      const pct = p.total > 0 ? ((p.done / p.total) * 100).toFixed(1) : "?"
      yield* Console.log(`[${p.status}] ${p.key} — ${p.done}/${p.total} (${pct}%)`)
    }),
  ).pipe(Effect.forkScoped)

  // Await the actual transfer result
  const { transferred, skipped, errors } = yield* result

  yield* Console.log(`Done: ${transferred.length} transferred, ${skipped.length} skipped`)
  if (errors.length > 0) {
    yield* Console.error(`${errors.length} errors:`)
    for (const e of errors) {
      yield* Console.error(`  ${e.key}: ${e.error.message}`)
    }
  }
})
```

## Without Progress (Fire and Forget)

```ts
const program = Effect.gen(function* () {
  const { result } = yield* transfer(source, dest)

  // No progress stream → just await result
  const { transferred, skipped, errors } = yield* result

  console.log(`Transferred ${transferred.length} files`)
  console.log(`Skipped ${skipped.length} (already existed)`)
  console.log(`${errors.length} failures`)
})
```

Or simpler — inline:

```ts
const { transferred } = yield* transfer(source, dest).pipe(
  Effect.flatMap(({ result }) => result),
)
```

## Transfer Options

| Option | Default | Description |
|--------|---------|-------------|
| `prefix` | `undefined` | Only transfer objects matching this prefix |
| `concurrency` | `8` | How many objects to transfer concurrently |
| `stopOnError` | `false` | Stop on first failure instead of collecting all errors |
| `timeout` | — | Per-object timeout in ms |
| `retries` | — | Retry count for provider failures |

## Notes

- Both arguments are full `FilesSDK.Files` instances (not raw adapters). Each leg honors its own `prefix`, retries, timeouts, and hooks.
- Destination objects that already exist are skipped (unless the adapter supports overwrite).
- The transfer walks the source with `listAll`, so it handles pagination automatically.

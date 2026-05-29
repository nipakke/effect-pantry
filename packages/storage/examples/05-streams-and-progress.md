# Streams & Progress

Upload and cross-provider transfer return a `{ result, progress }` pair — `result` is a deferred `Effect` and `progress` is a `Stream`. This design lets you observe progress without callbacks.

## Upload Progress

```ts
import { memory } from "files-sdk/memory"
import { Storage, StorageAdapter } from "@effect-pantry/storage"
import { Effect, Stream, Layer } from "effect"

const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)

const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // Upload returns { result, progress }
  const { result, progress } = yield* s.upload("large-file.bin", createLargeBlob(), {
    contentType: "application/octet-stream",
    multipart: { partSize: 16 * 1024 * 1024, concurrency: 4 },
  })

  // Fork progress logging — runs concurrently
  yield* Stream.runForEach(progress, (p) =>
    Effect.log(`Upload: ${p.loaded}/${p.total} bytes`),
  ).pipe(Effect.forkScoped)

  // Await the upload result
  const { key, size, etag } = yield* result

  Effect.log(`Done: ${key} (${size} bytes, etag: ${etag})`)
})
```

## Progress for UI Updates

Bridge progress to a React state updater or any callback:

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage
  const { result, progress } = yield* s.upload("video.mp4", file)

  // Fork progress to update external state
  yield* Stream.runForEach(progress, (p) =>
    Effect.sync(() => {
      // Call your UI framework's state setter
      updateProgressBar(p.loaded, p.total)
    }),
  ).pipe(Effect.forkScoped)

  const { key } = yield* result
  navigateTo(`/files/${key}`)
})
```

## Cancelling an Upload Mid-Stream

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  const { result, progress } = yield* s.upload("huge-file.bin", hugeFile)

  // Fork and interrupt after 5 seconds
  const fiber = yield* Effect.forkScoped(result)

  yield* Stream.runForEach(progress, (p) =>
    Effect.gen(function* () {
      if (p.loaded > 50_000_000) {
        yield* Effect.log("50MB reached — cancelling")
        yield* Fiber.interrupt(fiber)
      }
    }),
  ).pipe(Effect.forkScoped)

  const outcome = yield* Fiber.join(fiber)
  // Will be interrupted; cleanup handled by Scope
})
```

> Effect's interruption model automatically aborts the underlying request via `AbortSignal`, so no dangling connections.

## Transfer Progress

Same `{ result, progress }` pattern applies to `transfer()`:

```ts
import { transfer } from "@effect-pantry/storage"

const program = Effect.gen(function* () {
  const { result, progress } = yield* transfer(source, dest, {
    concurrency: 16,
  })

  yield* Stream.runForEach(progress, (p) =>
    Effect.log(`${p.status} ${p.key} (${p.done}/${p.total})`),
  ).pipe(Effect.forkScoped)

  const { transferred, errors } = yield* result

  if (errors.length > 0) {
    for (const e of errors) {
      yield* Effect.logError(`${e.key}: ${e.error.message}`)
    }
  }
})
```

## Aggregating Progress Across Multiple Uploads

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage
  const files = ["a.txt", "b.txt", "c.txt"]

  // Launch all uploads concurrently
  const uploads = yield* Effect.all(
    files.map((name, i) => s.upload(name, `content-${i}`)),
    { concurrency: 3 },
  )

  // Fork progress loggers for all
  for (const { result, progress } of uploads) {
    yield* Stream.runForEach(progress, (p) =>
      Effect.log(`Upload: ${p.loaded}/${p.total}`),
    ).pipe(Effect.forkScoped)
  }

  // Await all results
  const results = yield* Effect.all(uploads.map(({ result }) => result))
  console.log(`Uploaded ${results.length} files`)
})
```

## Stream as a Polling Mechanism

For long-running operations, you can poll progress at intervals:

```ts
const progressStream = Effect.gen(function* () {
  const s = yield* Storage.Storage
  const { result, progress } = yield* s.upload("big-file.zip", zipFile)

  // Fork the actual upload
  yield* Effect.forkScoped(result)

  // Drain the progress stream (ends when upload completes or scope closes)
  yield* Stream.runForEach(progress, (p) =>
    Effect.log(`${((p.loaded / p.total) * 100).toFixed(1)}%`),
  )
})
```

# Hooks & Monitoring

The underlying `files-sdk` emits action, error, and retry events. `@effect-pantry/storage` bridges these into Effect `Stream`s, making them composable with the rest of your system.

## Subscribing to All Events

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // Subscribe to each kind of event
  yield* s.hookStream("onAction").pipe(
    Stream.runForEach((e) => Effect.log(`Action: ${e.status} ${e.type} ${e.key}`)),
    Effect.forkScoped,
  )

  yield* s.hookStream("onError").pipe(
    Stream.runForEach((e) => Effect.log(`Error: ${e.error.code} on ${e.key}`)),
    Effect.forkScoped,
  )

  yield* s.hookStream("onRetry").pipe(
    Stream.runForEach((e) =>
      Effect.log(`Retry #${e.attempt} for ${e.key} (${e.error.code})`),
    ),
    Effect.forkScoped,
  )

  // Now run your operations — hooks fire as they happen
  yield* s.upload("data.txt", "Hello")
})
```

> Always fork the stream consumer (`Effect.forkScoped`) so it doesn't block your operations.

## Building a Metrics Collector

```ts
import { Ref, Effect, Stream } from "effect"
import type { HookEvent } from "@effect-pantry/storage"

const program = Effect.gen(function* () {
  const s = yield* Storage.Storage
  const metrics = yield* Ref.make({ uploads: 0, downloads: 0, errors: 0, bytes: 0 })

  // Track upload events
  yield* s.hookStream("onAction").pipe(
    Stream.filter((e) => e.type === "upload" && e.status === "completed"),
    Stream.runForEach((e) =>
      Ref.update(metrics, (m) => ({
        ...m,
        uploads: m.uploads + 1,
        bytes: m.bytes + (e.size ?? 0),
      })),
    ),
    Effect.forkScoped,
  )

  // Track errors
  yield* s.hookStream("onError").pipe(
    Stream.runForEach(() => Ref.update(metrics, (m) => ({ ...m, errors: m.errors + 1 }))),
    Effect.forkScoped,
  )

  yield* s.upload("a.txt", "aaa")
  yield* s.upload("b.txt", "bbb")
  yield* s.download("a.txt")

  console.log(yield* Ref.get(metrics)) // { uploads: 2, downloads: 1, errors: 0, bytes: 6 }
})
```

## Conditional Alerting

Fire an alert when error rate crosses a threshold:

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage
  const errors = yield* Ref.make(0)
  const total = yield* Ref.make(0)

  yield* s.hookStream("onAction").pipe(
    Stream.runForEach(() => Ref.update(total, (n) => n + 1)),
    Effect.forkScoped,
  )

  yield* s.hookStream("onError").pipe(
    Stream.runForEach((e) =>
      Effect.gen(function* () {
        const errs = yield* Ref.updateAndGet(errors, (n) => n + 1)
        const ops = yield* Ref.get(total)
        if (ops > 0 && errs / ops > 0.1) {
          yield* Effect.logError(
            `ALERT: error rate ${((errs / ops) * 100).toFixed(1)}% (${errs}/${ops})`,
          )
        }
      }),
    ),
    Effect.forkScoped,
  )
})
```

## Retry Observation

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  yield* s.hookStream("onRetry").pipe(
    Stream.runForEach((e) =>
      Effect.logWarning(
        `Retry ${e.attempt}/${e.retries} for ${e.key} — ${e.error.message}`,
      ),
    ),
    Effect.forkScoped,
  )
})
```

> **Note:** The internal PubSub is unbounded. If you never drain the stream and produce millions of events, memory grows. In practice, for normal workloads and short-lived scopes, this is fine.

/**
 * Example 03: Hooks & Monitoring
 *
 * The underlying files-sdk emits action, error, and retry events.
 * @effect-pantry/storage bridges these into Effect streams, making
 * them composable with the rest of your system.
 *
 * Run:  npx tsx examples/03-hooks-and-monitoring.ts
 */

// oxlint-disable no-console

import { memory } from "files-sdk/memory"
import { Storage, layer } from "../src/service.js"
import { StorageAdapter } from "../src/adapter.js"
import { Effect, Layer, Ref, Stream } from "effect"

// ── Layer Setup ───────────────────────────────────────────────────────
const storageLayer = layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)

// ── Program ───────────────────────────────────────────────────────────
const program = Effect.gen(function* () {
  const s = yield* Storage

  // --- Subscribe to all hook events -----------------------------------
  // Fork stream consumers so they don't block your operations.
  yield* s.hookStream("onAction").pipe(
    Stream.runForEach((e) =>
      Effect.log(`[action] ${e.status} ${e.type} ${e.key}`),
    ),
    Effect.forkScoped,
  )

  yield* s.hookStream("onError").pipe(
    Stream.runForEach((e) =>
      Effect.log(`[error]  ${e.error.code} on ${e.key}`),
    ),
    Effect.forkScoped,
  )

  yield* s.hookStream("onRetry").pipe(
    Stream.runForEach((e) =>
      Effect.log(`[retry]  attempt ${e.attempt} for ${e.key} (${e.error.code})`),
    ),
    Effect.forkScoped,
  )

  // --- Metrics collection ---------------------------------------------
  const metrics = yield* Ref.make({ uploads: 0, downloads: 0, errors: 0, bytes: 0 })

  // Track upload completions — the action event carries `result` (UploadResult)
  // with size info available via type assertion on the unknown field.
  yield* s.hookStream("onAction").pipe(
    Stream.filter((e) => e.type === "upload" && e.status === "success"),
    Stream.runForEach((e) =>
      Ref.update(metrics, (m) => {
        const uploadSize = (e.result as { size?: number } | undefined)?.size ?? 0
        return { ...m, uploads: m.uploads + 1, bytes: m.bytes + uploadSize }
      }),
    ),
    Effect.forkScoped,
  )

  yield* s.hookStream("onAction").pipe(
    Stream.filter((e) => e.type === "download" && e.status === "success"),
    Stream.runForEach(() =>
      Ref.update(metrics, (m) => ({ ...m, downloads: m.downloads + 1 })),
    ),
    Effect.forkScoped,
  )

  yield* s.hookStream("onError").pipe(
    Stream.runForEach(() =>
      Ref.update(metrics, (m) => ({ ...m, errors: m.errors + 1 })),
    ),
    Effect.forkScoped,
  )

  // --- Run operations — hooks fire as they happen ---------------------
  // upload() returns { result, progress } — yield* the result to await completion
  const { result: r1 } = yield* s.upload("a.txt", "aaa")
  yield* r1
  const { result: r2 } = yield* s.upload("b.txt", "bbb")
  yield* r2
  yield* s.download("a.txt")

  // Give forked stream consumers a moment to process PubSub events
  yield* Effect.sleep(10)

  const final = yield* Ref.get(metrics)
  console.log("Metrics:", final)
  // Expected: { uploads: 2, downloads: 1, errors: 0, bytes: 6 }
})

// Effect.forkScoped requires a Scope — wrap the program in Effect.scoped
const scoped = Effect.scoped(program)
Effect.runPromise(Effect.provide(scoped, storageLayer))

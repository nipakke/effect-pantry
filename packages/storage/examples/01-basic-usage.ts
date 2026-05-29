/**
 * Example 01: Basic Usage
 *
 * Full CRUD with the in-memory adapter — no credentials, no network,
 * perfect for development and tests.
 *
 * Run:  npx tsx examples/01-basic-usage.ts
 */

// oxlint-disable no-console

import { memory } from "files-sdk/memory"
import { Storage, layer } from "../src/service.js"
import { StorageAdapter } from "../src/adapter.js"
import { Effect, Layer } from "effect"

// ── Layer Setup ───────────────────────────────────────────────────────
// Provide the memory adapter — swap this for s3/r2/fs in production.
const storageLayer = layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)

// ── Program ───────────────────────────────────────────────────────────
const program = Effect.gen(function* () {
  const s = yield* Storage

  // --- Upload ----------------------------------------------------------
  const { result } = yield* s.upload("data.json", JSON.stringify({ count: 42 }), {
    contentType: "application/json",
    metadata: { userId: "123" },
  })
  const { key, size, etag } = yield* result
  console.log(`Uploaded:  ${key} (${size} bytes, etag: ${etag})`)

  // --- Download --------------------------------------------------------
  const file = yield* s.download("data.json")
  const text = yield* Effect.promise(() => file.text())
  const data = JSON.parse(text)
  console.log(`Downloaded: count = ${data.count}`)

  // --- Check Existence & Head ------------------------------------------
  const exists = yield* s.exists("data.json")
  const meta = yield* s.head("data.json")
  console.log(`Exists: ${exists},  type: ${meta.type},  lastModified: ${meta.lastModified}`)

  // --- List ------------------------------------------------------------
  const { items, cursor } = yield* s.list({ prefix: "data", limit: 100 })
  console.log(`List: ${items.length} item(s) — ${items.map((i) => i.key).join(", ")}`)

  // --- Copy & Move -----------------------------------------------------
  yield* s.copy("data.json", "data.bak.json")
  console.log("Copied data.json → data.bak.json")

  yield* s.move("data.bak.json", "archive/data.bak.json")
  console.log("Moved data.bak.json → archive/data.bak.json")

  // --- URL Generation --------------------------------------------------
  const url = yield* s.url("archive/data.bak.json")
  console.log(`Download URL: ${url}`)

  const signed = yield* s.url("archive/data.bak.json", { expiresIn: 3600 })
  console.log(`Signed URL (1h): ${signed}`)

  // --- File Handle (key-bound ergonomics) ------------------------------
  const avatar = s.file("avatars/abc.png")

  // upload() returns { result, progress } — yield* the result to await completion
  const { result: avatarResult } = yield* avatar.upload("fake-image-bytes", {
    contentType: "image/png",
  })
  yield* avatarResult

  if (yield* avatar.exists()) {
    const info = yield* avatar.head()
    console.log(`Avatar exists: ${info.size} bytes, ${info.type}`)
  }

  yield* avatar.copyTo("avatars/abc.bak.png")
  console.log("Backed up avatar")

  // --- Delete ----------------------------------------------------------
  yield* s.delete("data.json")
  yield* s.delete("archive/data.bak.json")
  console.log("Cleanup done")
})

// ── Run ───────────────────────────────────────────────────────────────
Effect.runPromise(Effect.provide(program, storageLayer))

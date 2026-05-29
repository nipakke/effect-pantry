# Basic Usage

Full CRUD with the in-memory adapter — no credentials, no network, perfect for development and tests.

## Setup

```ts
import { memory } from "files-sdk/memory"
import { Storage, StorageAdapter } from "@effect-pantry/storage"
import { Effect, Layer } from "effect"

const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
)
```

## Upload and Download

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // Upload with automatic content type detection
  const { result } = yield* s.upload("data.json", JSON.stringify({ count: 42 }), {
    contentType: "application/json",
    metadata: { userId: "123" },
  })
  const { key, size, etag } = yield* result

  // Download and parse
  const file = yield* s.download("data.json")
  const text = yield* file.text()
  const data = JSON.parse(text)
  console.log(data) // { count: 42 }
})
```

## Check Existence and Metadata

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  const exists = yield* s.exists("data.json")
  if (exists) {
    const meta = yield* s.head("data.json")
    console.log(meta.size, meta.type, meta.lastModified)
  }
})
```

## List Objects

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // List with prefix filtering
  const { items, cursor } = yield* s.list({ prefix: "avatars/", limit: 100 })

  for (const item of items) {
    console.log(`${item.key} — ${item.size} bytes`)
    // Body accessor lazily fetches on call:
    // const content = yield* Effect.tryPromise(() => item.text())
  }

  // If cursor is non-null, there are more pages
  if (cursor) {
    const page2 = yield* s.list({ prefix: "avatars/", cursor })
  }
})
```

## Copy and Move

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  yield* s.copy("data.json", "data.bak.json")
  yield* s.move("data.json", "archive/data.json")
})
```

## Generate URLs

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  // Accessible download URL (public or signed, depending on adapter)
  const url = yield* s.url("data.json")
  const signed = yield* s.url("data.json", { expiresIn: 3600 })

  // Presigned upload URL for browser-direct uploads
  const uploadUrl = yield* s.signedUploadUrl("uploads/file.png", {
    expiresIn: 300,
    contentType: "image/png",
    maxSize: 5_000_000,
  })
  // → { method: "PUT", url, headers? } | { method: "POST", url, fields }
})
```

## Delete

```ts
const program = Effect.gen(function* () {
  const s = yield* Storage.Storage

  yield* s.delete("data.json")
  // No-op friendly — deleting a missing key resolves successfully
})
```

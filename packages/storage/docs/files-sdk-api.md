# files-sdk API Reference

> Extracted from https://files-sdk.dev for use in building `@effect-pantry/files`

## Package

- **Name**: `files-sdk`
- **Runtime**: ESM only (`"type": "module"`), Node 18+, Bun
- **One runtime dep**: `commander` (CLI)
- **Subpath exports**: Per-adapter (`files-sdk/s3`, `files-sdk/vercel-blob`, etc.)
- **Peer deps**: Per-adapter; not bundled. e.g. `@aws-sdk/client-s3` for S3 family
- **Types**: Ships own `.d.ts` — no `@types/files-sdk`

## Constructor

```ts
import { Files } from "files-sdk";
import { s3 } from "files-sdk/s3";

const files = new Files({
  adapter: s3({ bucket: "uploads", region: "us-east-1" }),
  prefix: "users",        // optional: namespace all keys
  timeout: 10_000,         // optional: default per-attempt timeout ms
  retries: 3,              // optional: default retry count
  hooks: {                 // optional: observe operations
    onAction(event) { },
    onError(event) { },
    onRetry(event) { },
  },
});
```

Swap adapter to switch backends — all 9 methods stay the same.

---

## Core Methods (9)

### `upload(key, body, options?)` → `UploadResult`

Write a body to a key. Accepts `File`, `Blob`, `ReadableStream`, `ArrayBuffer`, `string`.

```ts
await files.upload("avatars/abc.png", file, {
  contentType: "image/png",
  cacheControl: "public, max-age=31536000",
  metadata: { userId: "123" },
  onProgress: ({ loaded, total }) => { },
  multipart: true,              // or { partSize: 16*1024*1024, concurrency: 8 }
});
```

**Options**: `contentType?`, `cacheControl?`, `metadata?`, `onProgress?`, `multipart?` (boolean | {partSize, concurrency}), `signal?`, `timeout?`, `retries?`

> **@effect-pantry/storage note:** `Storage.upload` omits `onProgress` and `signal` from
> options — progress is returned as an Effect `Stream` via `{ result, progress }`.

**Returns**: `{ key, size, contentType, etag, lastModified }`

**Bulk form** — `files.upload(items[])` returns `{ uploaded: UploadResult[], errors?: Array<{ key, error }> }`.

**Item (bulk)**: `{ key: string, body: Body, contentType?, cacheControl?, metadata?, multipart? }`

**Bulk options**: `onProgress?`, `concurrency?` (default 8), `stopOnError?` (default false)

---

### `download(key, options?)` → `StoredFile | ReadableStream`

Read an object. Returns `StoredFile` (Blob-backed) by default, or `ReadableStream` with `as: "stream"`.

```ts
const file = await files.download("avatars/abc.png");
const stream = await files.download("avatars/abc.png", { as: "stream" });
```

**Options**: `as?` (`"stream"`), `range?` (`{ start, end? }`), `signal?`, `timeout?`, `retries?`

**Bulk form** — `files.download(keys[])` returns `{ downloaded: StoredFile[], errors? }`.

---

### `head(key, options?)` → `StoredFile`

Fetch metadata without materializing body. Body accessors lazy-fetch on call.

```ts
const info = await files.head("avatars/abc.png");
```

**Bulk form** — `files.head(keys)` returns `{ files: StoredFile[], errors? }`.

---

### `exists(key, options?)` → `boolean`

Check existence without fetching body. Returns `true`/`false`. Permission/auth failures still throw.

```ts
const present = await files.exists("avatars/abc.png");
```

**Bulk form** — `files.exists(keys)` returns `{ existing: string[], missing: string[], errors? }`.

---

### `delete(key, options?)` → `void`

Remove an object. No-op friendly on most providers (missing key resolves successfully).

```ts
await files.delete("avatars/abc.png");
```

**Bulk form** — `files.delete(keys)` returns `{ deleted: string[], errors? }`.
Bulk options: `concurrency?` (default 8), `stopOnError?` (default false).

---

### `copy(from, to, options?)` → `void`

Copy `from` → `to`. Server-side where provider supports it (S3 `CopyObject`, GCS, etc.), streaming read+write fallback otherwise.

```ts
await files.copy("avatars/abc.png", "avatars/abc.bak.png");
```

---

### `move(from, to, options?)` → `void`

Rename/move. Native atomic rename where available; `copy` + `delete` fallback everywhere else. Moving a key onto itself is a no-op.

```ts
await files.move("uploads/tmp.png", "avatars/user-123.png");
```

---

### `list(options?)` → `{ items: StoredFile[], cursor: string | null }`

Cursor-paginated listing with prefix filter. Each item is `StoredFile` with lazy body accessor.

```ts
const { items, cursor } = await files.list({ prefix: "avatars/", limit: 100 });
```

**`listAll(options?)`** — Async iterable that walks every page:

```ts
for await (const file of files.listAll({ prefix: "avatars/" })) { }
```

Options: `prefix?`, `cursor?`, `limit?`, `signal?`, `timeout?`, `retries?`

---

### `url(key, options?)` → `string`

Returns a URL to fetch `key`. Signed (S3 GetObject, Azure SAS, Supabase) or direct CDN/public URL.

```ts
const url = await files.url("avatars/abc.png");
const short = await files.url("avatars/abc.png", { expiresIn: 60 });
const force = await files.url("avatars/abc.png", { responseContentDisposition: "attachment" });
```

Options: `expiresIn?`, `responseContentDisposition?`, `signal?`, `timeout?`, `retries?`

---

### `signedUploadUrl(key, options)` → `PUTContract | POSTContract`

Presigned upload URL for browser-direct uploads.

```ts
const upload = await files.signedUploadUrl("avatars/abc.png", {
  expiresIn: 60,
  contentType: "image/png",
  maxSize: 5_000_000,
});
// → { method: "PUT", url, headers? } | { method: "POST", url, fields }
```

Options: `expiresIn` (required), `contentType?`, `maxSize?`, `minSize?`, `signal?`, `timeout?`, `retries?`

---

## FileHandle

`files.file(key)` returns a `FileHandle` bound to one key. Same ops without re-passing the key:

- `handle.upload(body, opts?)`
- `handle.download(opts?)`
- `handle.head(opts?)`
- `handle.exists(opts?)`
- `handle.delete(opts?)`
- `handle.url(opts?)`
- `handle.signedUploadUrl(opts)`
- `handle.copyTo(destKey, opts?)` — handle is source
- `handle.copyFrom(srcKey, opts?)` — handle is destination
- `handle.moveTo(destKey, opts?)` — handle is source
- `handle.moveFrom(srcKey, opts?)` — handle is destination

---

## StoredFile

```ts
interface StoredFile {
  name: string;            // = key
  size: number;
  type: string;            // = contentType
  lastModified?: number;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  stream(): ReadableStream;
  blob(): Promise<Blob>;
  key: string;
  etag?: string;
  metadata?: Record<string, string>;
}
```

Body accessors on `head`/`list` results lazy-fetch on call.

---

## Shared Operation Options

Every method accepts these alongside method-specific options:

| Option | Type | Description |
|--------|------|-------------|
| `signal` | `AbortSignal` | Cancel the in-flight call |
| `timeout` | `number` | Per-attempt timeout in ms |
| `retries` | `number | { max, backoff? }` | Retry config; only `Provider` failures |

Per-call values win over constructor defaults.

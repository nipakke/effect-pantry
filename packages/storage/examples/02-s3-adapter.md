# S3 / R2 Adapter

Real cloud storage with the S3 adapter. Swap to R2 (Cloudflare), Tigris, or any S3-compatible service by changing the adapter — the rest of your code stays the same.

## S3 Setup

```ts
import { s3 } from "files-sdk/s3"
import { Storage, StorageAdapter } from "@effect-pantry/storage"
import { Layer } from "effect"

const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, s3({
    bucket: "my-uploads",
    region: "us-east-1",
    // Credentials resolved from env, ~/.aws/credentials, or IAM role
  }))),
)
```

Explicit credentials:

```ts
s3({
  bucket: "my-uploads",
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  endpoint: "https://s3.us-east-1.amazonaws.com", // optional: custom endpoint
  forcePathStyle: false,                            // optional: path-style buckets
})
```

## R2 Setup

```ts
import { r2 } from "files-sdk/r2"

const layer = Storage.layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, r2({
    accountId: process.env.CF_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: "my-assets",
  }))),
)
```

## Configuring the Storage Instance

Pass `MakeOptions` to `Storage.layer()` for a global prefix, timeouts, or retries — no need to create the SDK instance manually:

```ts
const layer = Storage.layer({
  prefix: "users/123/",    // namespace all keys
  timeout: 10_000,          // per-attempt timeout (ms)
  retries: 3,               // retry on Provider errors
}).pipe(
  Layer.provide(Layer.succeed(StorageAdapter, s3({
    bucket: "my-uploads",
    region: "us-east-1",
  }))),
)
```

The same options work with `Storage.make()` for inline use:

```ts
const s = yield* Storage.make({ prefix: "users/123/", timeout: 10_000 })
```

## Environment Variables

Most adapters resolve credentials from environment variables automatically. Keep secrets out of your code:

```bash
# S3
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1

# R2
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
```

## Error Handling with S3

S3-specific failures are mapped to the standard storage errors:

```ts
import { StorageNotFoundError, StorageProviderError } from "@effect-pantry/storage"

yield* s.download("nonexistent.jpg").pipe(
  Effect.catchTags({
    StorageNotFoundError: (e) =>
      Effect.logWarning(`Not found: ${e.message}`).pipe(Effect.as(null)),
    StorageProviderError: (e) => {
      if (e.aborted) return Effect.logWarning("Request was cancelled")
      return Effect.fail(e)
    },
  }),
)
```

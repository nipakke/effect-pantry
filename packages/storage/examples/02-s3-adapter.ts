/**
 * Example 02: S3 / R2 Adapter
 *
 * Real cloud storage with files-sdk adapters. Swap S3 for R2, Tigris,
 * or any S3-compatible service by changing the adapter — your code
 * stays the same.
 *
 * NOTE: This example requires valid AWS or Cloudflare credentials.
 * It demonstrates the setup pattern but won't run without them.
 *
 * Run:
 *   AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… npx tsx examples/02-s3-adapter.ts
 */

// oxlint-disable no-console

import { Effect, Layer } from "effect"
import { layer } from "../src/service.js"
import { StorageAdapter } from "../src/adapter.js"
import { StorageNotFoundError, StorageProviderError } from "../src/errors.js"

// ── Choose an adapter ─────────────────────────────────────────────────
// Uncomment one of these blocks and fill in your credentials.

// --- S3 (Option A: auto-resolved credentials) ---
//
// import { s3 } from "files-sdk/s3"
// const adapter = s3({ bucket: "my-uploads", region: "us-east-1" })

// --- S3 (Option B: explicit credentials) ---
//
// import { s3 } from "files-sdk/s3"
// const adapter = s3({
//   bucket: "my-uploads",
//   region: "us-east-1",
//   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
// })

// --- R2 ---
//
// import { r2 } from "files-sdk/r2"
// const adapter = r2({
//   accountId: process.env.CF_ACCOUNT_ID!,
//   accessKeyId: process.env.R2_ACCESS_KEY_ID!,
//   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
//   bucket: "my-assets",
// })

// ── Layer setup (with MakeOptions) ────────────────────────────────────
//
// const storageLayer = layer({
//   prefix: "users/123/",   // namespace all keys
//   timeout: 10_000,         // per-attempt timeout (ms)
//   retries: 3,              // retry on Provider errors
// }).pipe(
//   Layer.provide(Layer.succeed(StorageAdapter, adapter)),
// )

// ── Error Handling (pattern) ──────────────────────────────────────────
// All S3 failures are mapped to standard tagged errors:

const errorHandlingExample = Effect.gen(function* () {
  //   const s = yield* Storage  (after providing a valid layer)
  //
  //   yield* s.download("nonexistent.jpg").pipe(
  //     Effect.catchTags({
  //       StorageNotFoundError: (e) =>
  //         Effect.logWarning(`Not found: ${e.message}`).pipe(Effect.as(null)),
  //       StorageProviderError: (e) => {
  //         if (e.aborted) return Effect.logWarning("Request was cancelled")
  //         return Effect.fail(e)
  //       },
  //     }),
  //   )
})

// ── Environment Variables ─────────────────────────────────────────────
// Most adapters resolve credentials from env automatically:
//
//   export AWS_ACCESS_KEY_ID=...
//   export AWS_SECRET_ACCESS_KEY=...
//   export AWS_REGION=us-east-1
//
//   export R2_ACCESS_KEY_ID=...
//   export R2_SECRET_ACCESS_KEY=...

console.log(`
Example 02 shows S3/R2 adapter setup patterns.
Uncomment the adapter import + layer setup and provide
valid credentials to run against a real bucket.

For a runnable example, try:
  npx tsx examples/01-basic-usage.ts
`)

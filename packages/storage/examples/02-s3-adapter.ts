// oxlint-disable no-console

/**
 * Example 02: S3 Adapter
 *
 * Real cloud storage with the files-sdk S3 adapter. Works with any
 * S3-compatible service (AWS S3, Cloudflare R2, Tigris, MinIO, etc.).
 *
 * Set these environment variables:
 *   S3_BUCKET          — bucket name (required)
 *   AWS_REGION         — AWS region (defaults to us-east-1)
 *   AWS_ACCESS_KEY_ID  — AWS access key
 *   AWS_SECRET_ACCESS_KEY — AWS secret key
 *   S3_ENDPOINT        — custom endpoint for R2/MinIO/etc. (optional)
 *
 * Run:
 *   S3_BUCKET=my-bucket AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… npx tsx examples/02-s3-adapter.ts
 */

import { s3 } from 'files-sdk/s3';
import type { S3AdapterOptions } from 'files-sdk/s3';
import { Storage, layer } from '../src/service.js';
import { StorageAdapter } from '../src/adapter.js';
import { Effect, Layer } from 'effect';

// ── Adapter Setup ───────────────────────────────────────────────────────

const bucket = process.env.S3_BUCKET!;
const region = process.env.AWS_REGION ?? 'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
const endpoint = process.env.S3_ENDPOINT;

if (!bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing required environment variables:');
  if (!bucket) console.error('  S3_BUCKET');
  if (!accessKeyId) console.error('  AWS_ACCESS_KEY_ID');
  if (!secretAccessKey) console.error('  AWS_SECRET_ACCESS_KEY');
  console.error('\nExample:');
  console.error(
    '  S3_BUCKET=my-bucket AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… npx tsx examples/02-s3-adapter.ts',
  );
  process.exit(1);
}

const adapterOptions: S3AdapterOptions = {
  bucket,
  region,
  credentials: { accessKeyId, secretAccessKey },
  ...(endpoint ? { endpoint } : {}),
};

const adapter = s3(adapterOptions);

// ── Layer Setup ─────────────────────────────────────────────────────────

const storageLayer = layer({ prefix: 'examples/02/' }).pipe(
  Layer.provide(Layer.succeed(StorageAdapter, adapter)),
);

// ── Program ─────────────────────────────────────────────────────────────

const program = Effect.gen(function* () {
  const s = yield* Storage;

  // --- Upload ----------------------------------------------------------
  console.log('Uploading example file...');
  const key = `hello-${Date.now()}.txt`;
  const { result } = yield* s.upload(key, 'Hello from S3 adapter!', {
    contentType: 'text/plain',
    metadata: { source: 'effect-pantry-example-02' },
  });
  const { size, etag } = yield* result;
  console.log(`Uploaded:  ${key} (${size} bytes, etag: ${etag})`);

  // --- Download --------------------------------------------------------
  const file = yield* s.download(key);
  const text = yield* Effect.promise(() => file.text());
  console.log(`Downloaded: "${text}"`);

  // --- Head ------------------------------------------------------------
  const meta = yield* s.head(key);
  console.log(`Metadata:  type=${meta.type}, lastModified=${meta.lastModified}`);

  // --- List ------------------------------------------------------------
  const { items } = yield* s.list({ prefix: 'examples/02/hello' });
  console.log(`Listing:   ${items.length} file(s) with prefix "examples/02/hello"`);

  // --- Copy & Move -----------------------------------------------------
  const copyKey = `${key}.bak`;
  yield* s.copy(key, copyKey);
  console.log(`Copied:    ${key} → ${copyKey}`);

  const movedKey = `examples/02/archive/${key}`;
  yield* s.move(copyKey, movedKey);
  console.log(`Moved:     ${copyKey} → ${movedKey}`);

  // --- Signed URL ------------------------------------------------------
  const url = yield* s.url(key, { expiresIn: 3600 });
  console.log(`URL (1h):  ${url}`);

  // --- FileHandle ------------------------------------------------------
  const handle = s.file(key);
  if (yield* handle.exists()) {
    console.log(`Handle:    '${handle.key}' exists`);
  }

  // --- Delete ----------------------------------------------------------
  yield* s.delete(key);
  yield* s.delete(movedKey);
  console.log('Cleanup done');
});

// ── Error Handling ──────────────────────────────────────────────────────

const safe = program.pipe(
  Effect.catchTags({
    StorageNotFoundError: (e) => Effect.logError(`Not found: ${e.message}`),
    StorageProviderError: (e) => {
      if (e.aborted) return Effect.logWarning('Request was aborted');
      return Effect.logError(`Provider error: ${e.message}`);
    },
  }),
  Effect.catchAllDefect((defect) => Effect.logError(`Unexpected error: ${String(defect)}`)),
);

// ── Run ─────────────────────────────────────────────────────────────────
await Effect.runPromise(Effect.provide(safe, storageLayer));

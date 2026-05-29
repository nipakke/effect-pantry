/**
 * Example 05: Streams & Progress
 *
 * Upload and transfer return a `{ result, progress }` pair:
 * `result` is a deferred Effect, `progress` is a Stream.
 * Fork the progress stream to observe, then yield* the result.
 *
 * Run:  npx tsx examples/05-streams-and-progress.ts
 */

// oxlint-disable no-console

import { memory } from 'files-sdk/memory';
import { Storage, layer } from '../src/service.js';
import { StorageAdapter } from '../src/adapter.js';
import { Effect, Fiber, Layer, Stream } from 'effect';

// ── Layer Setup ───────────────────────────────────────────────────────
const storageLayer = layer().pipe(Layer.provide(Layer.succeed(StorageAdapter, memory())));

// ── Helper: create a large body for progress visibility ───────────────
function createBlob(size: number): Uint8Array {
  return new Uint8Array(size);
}

// ── Program ───────────────────────────────────────────────────────────
const program = Effect.gen(function* () {
  const s = yield* Storage;

  // --- Upload with progress tracking ----------------------------------
  console.log('--- Upload Progress ---');
  const largeFile = createBlob(5_000_000); // 5 MB

  const { result, progress } = yield* s.upload('large-file.bin', largeFile, {
    contentType: 'application/octet-stream',
  });

  // Fork progress logging — runs concurrently with the upload
  yield* Stream.runForEach(progress, (p) =>
    Effect.log(`Upload: ${p.loaded}/${p.total} bytes`),
  ).pipe(Effect.forkScoped);

  // Await the upload result
  const uploadResult = yield* result;
  console.log(`Upload complete: ${uploadResult.key} (${uploadResult.size} bytes)`);

  // --- Cancelling mid-stream ------------------------------------------
  console.log('\n--- Cancellation ---');
  const hugeFile = createBlob(10_000_000); // 10 MB

  const { result: cancelResult, progress: cancelProgress } = yield* s.upload(
    'huge-file.bin',
    hugeFile,
  );

  // Fork the upload so we can interrupt it
  const fiber = yield* Effect.forkScoped(cancelResult);

  // Watch progress — interrupt after 2 MB
  yield* Stream.runForEach(cancelProgress, (p) =>
    Effect.gen(function* () {
      if (p.loaded > 2_000_000) {
        yield* Effect.log('2 MB reached — cancelling');
        yield* Fiber.interrupt(fiber);
      }
    }),
  ).pipe(Effect.forkScoped);

  // The fiber will be interrupted; Effect's interruption model
  // automatically aborts the underlying request via AbortSignal.
  const outcome = yield* Fiber.join(fiber).pipe(Effect.exit);
  console.log(`Upload outcome: ${outcome._tag}`); // "Failure" (interrupted)

  // --- Aggregating progress across multiple uploads -------------------
  console.log('\n--- Parallel Uploads ---');
  const files = ['x.txt', 'y.txt', 'z.txt'];

  const uploads = yield* Effect.all(
    files.map((name, i) => s.upload(name, `content-${i}`)),
    { concurrency: 3 },
  );

  // Fork progress loggers for all uploads concurrently
  for (const { progress: p } of uploads) {
    yield* Stream.runForEach(p, (ev) => Effect.log(`Upload: ${ev.loaded}/${ev.total}`)).pipe(
      Effect.forkScoped,
    );
  }

  // Await all results
  const results = yield* Effect.all(uploads.map(({ result: r }) => r));
  console.log(`Uploaded ${results.length} files: ${results.map((r) => r.key).join(', ')}`);
});

// Effect.forkScoped requires a Scope — wrap the program in Effect.scoped
const scoped = Effect.scoped(program);
await Effect.runPromise(Effect.provide(scoped, storageLayer));

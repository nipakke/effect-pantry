/**
 * @effect-pantry/storage — Example 06: search() and capabilities
 *
 * files-sdk 1.8+ features:
 * - search() finds objects by glob, regex, substring, or exact pattern
 * - capabilities queries adapter features at runtime
 *
 * Run:  npx tsx examples/06-search-and-capabilities.ts
 */

// oxlint-disable no-console

import { memory } from 'files-sdk/memory';
import { Effect, Layer, Stream } from 'effect';
import { Storage, layer } from '../src/service.js';
import { StorageAdapter } from '../src/adapter.js';

const storageLayer = layer({ prefix: 'photos/' }).pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
);

const program = Effect.gen(function* () {
  const s = yield* Storage;

  // ── Seed some data ────────────────────────────────────────────────
  const uploads = ['profile.png', 'cover.jpg', 'vacation/beach.jpg', 'vacation/sunset.png'];
  for (const key of uploads) {
    const { result } = yield* s.upload(key, `${key} content`);
    yield* result;
  }

  // ── Capabilities ──────────────────────────────────────────────────
  const caps = s.capabilities;
  console.log('Adapter capabilities:', {
    rangeRead: caps.rangeRead,
    delimiter: caps.delimiter,
    metadata: caps.metadata,
    multipart: caps.multipart,
    signedUrlSupported: caps.signedUrl.supported,
  });

  // ── Search by glob (default) ──────────────────────────────────────
  console.log('\nGlob: *.png');
  yield* s.search('*.png').pipe(
    Stream.runForEach((file) => Effect.sync(() => console.log(`  ${file.key} (${file.size}B)`))),
  );

  // ── Search by globstar ────────────────────────────────────────────
  console.log('\nGlobstar: **/*.jpg');
  yield* s.search('**/*.jpg').pipe(
    Stream.runForEach((file) => Effect.sync(() => console.log(`  ${file.key} (${file.size}B)`))),
  );

  // ── Search by substring ───────────────────────────────────────────
  console.log('\nSubstring: "profile"');
  yield* s.search('profile', { match: 'substring' }).pipe(
    Stream.runForEach((file) => Effect.sync(() => console.log(`  ${file.key}`))),
  );

  // ── Search with maxResults ────────────────────────────────────────
  console.log('\nFirst 2 matches for **/*');
  yield* s.search('**/*', { maxResults: 2 }).pipe(
    Stream.runForEach((file) => Effect.sync(() => console.log(`  ${file.key}`))),
  );
});

await Effect.runPromise(Effect.provide(program, storageLayer));

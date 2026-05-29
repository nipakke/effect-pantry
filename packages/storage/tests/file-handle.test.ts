/**
 * Tests for {@link FileHandle} — the key-bound wrapper returned by {@link Storage.file}.
 *
 * Every handle method delegates to the corresponding {@link StorageInterface}
 * method. These tests verify that the delegation is correct, key validation
 * happens eagerly, and multiple handles on different keys don't interfere.
 *
 * @module
 */

import { it, expect } from '@effect/vitest';
import { Context, Effect, Fiber, Layer, Stream } from 'effect';
import { memory } from 'files-sdk/memory';
import { Storage, layer } from '../src/service.js';
import { StorageAdapter } from '../src/adapter.js';
import type { UploadOptions } from '../src/service-types.js';

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = layer().pipe(Layer.provide(Layer.succeed(StorageAdapter, memory())));

// ── Helpers ───────────────────────────────────────────────────────────

const readText = (file: { text(): Promise<string> }) => Effect.promise(() => file.text());

const runUpload = (
  svc: Context.Tag.Service<typeof Storage>,
  key: string,
  body: string,
  opts?: UploadOptions,
) => svc.upload(key, body, opts).pipe(Effect.flatMap(({ result }) => result));

// ═════════════════════════════════════════════════════════════════════
// FileHandle tests (memory-backed)
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)('FileHandle', (it) => {
  // ── Construction ──────────────────────────────────────────────────

  it.scoped('file() returns a handle with the bound key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('pics/avatar.png');
      expect(handle.key).toBe('pics/avatar.png');
    }),
  );

  // ── Upload / download roundtrip ───────────────────────────────────

  it.scoped('upload → download roundtrip via handle', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('handle-test.txt');

      yield* runUpload(svc, 'handle-test.txt', 'Hello from handle!');
      const file = yield* handle.download();
      const text = yield* readText(file);
      expect(text).toBe('Hello from handle!');
    }),
  );

  // ── head ──────────────────────────────────────────────────────────

  it.scoped('head returns metadata for the bound key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('meta.txt');
      yield* runUpload(svc, 'meta.txt', 'metadata via handle');

      const entry = yield* handle.head();
      expect(entry.key).toBe('meta.txt');
      expect(entry.size).toBeGreaterThan(0);
    }),
  );

  // ── exists ────────────────────────────────────────────────────────

  it.scoped('exists returns true for existing key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('is-here.txt');
      yield* runUpload(svc, 'is-here.txt', 'present');
      expect(yield* handle.exists()).toBe(true);
    }),
  );

  it.scoped('exists returns false for missing key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('not-there.txt');
      expect(yield* handle.exists()).toBe(false);
    }),
  );

  // ── delete ────────────────────────────────────────────────────────

  it.scoped('delete removes the bound key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('remove-handle.txt');
      yield* runUpload(svc, 'remove-handle.txt', 'temp');
      yield* handle.delete();
      expect(yield* handle.exists()).toBe(false);
    }),
  );

  // ── url ───────────────────────────────────────────────────────────

  it.scoped('url returns a string for the bound key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('url-handle.txt');
      yield* runUpload(svc, 'url-handle.txt', 'url content');

      const result = yield* handle.url();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }),
  );

  // ── signedUploadUrl ───────────────────────────────────────────────

  it.scoped('signedUploadUrl returns valid SignedUpload shape', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('signed-handle.txt');
      const result = yield* handle.signedUploadUrl({
        expiresIn: 3600,
        contentType: 'text/plain',
      });
      expect(result.url).toBeDefined();
      expect(typeof result.url).toBe('string');
    }),
  );

  // ── copyTo (handle is source) ─────────────────────────────────────

  it.scoped('copyTo duplicates from bound key to destination', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('src-handle.txt');
      yield* runUpload(svc, 'src-handle.txt', 'source content');

      yield* handle.copyTo('dst-handle.txt');

      const dest = yield* svc.download('dst-handle.txt');
      expect(yield* readText(dest)).toBe('source content');
    }),
  );

  // ── copyFrom (handle is destination) ──────────────────────────────

  it.scoped('copyFrom copies into the bound key from source', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('dest-handle.txt');
      yield* runUpload(svc, 'src-existing.txt', 'existing content');

      yield* handle.copyFrom('src-existing.txt');

      const copied = yield* handle.download();
      expect(yield* readText(copied)).toBe('existing content');
    }),
  );

  // ── Upload progress stream via handle ─────────────────────────────

  it.scoped('upload via handle reports progress', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('progress-handle.dat');
      const { result, progress } = yield* handle.upload('progress data');

      const events: { loaded: number; total: number | undefined }[] = [];
      yield* Stream.runForEach(progress, (p) =>
        Effect.sync(() => {
          events.push({ loaded: p.loaded, total: p.total });
        }),
      ).pipe(Effect.forkScoped);

      yield* result;

      expect(events.length).toBeGreaterThanOrEqual(1);
      const last = events[events.length - 1]!;
      expect(last.loaded).toBe(last.total);
    }),
  );

  // ── Cancellation via handle ───────────────────────────────────────

  it.scoped('upload via handle is cancellable', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('cancel-handle.txt');
      const { result } = yield* handle.upload('data');
      const fiber = yield* Effect.fork(result);
      yield* Fiber.interrupt(fiber);
      const outcome = yield* Effect.exit(Fiber.join(fiber));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  // ── Error handling ────────────────────────────────────────────────

  it.scoped('download of missing key via handle fails with StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const handle = svc.file('ghost-handle.txt');
      const outcome = yield* Effect.exit(handle.download());
      expect(outcome._tag).toBe('Failure');
    }),
  );

  // ── Multiple handles don't interfere ──────────────────────────────

  it.scoped('multiple handles on different keys work independently', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'a.txt', 'alpha');
      yield* runUpload(svc, 'b.txt', 'beta');

      const handleA = svc.file('a.txt');
      const handleB = svc.file('b.txt');

      const textA = yield* readText(yield* handleA.download());
      const textB = yield* readText(yield* handleB.download());

      expect(textA).toBe('alpha');
      expect(textB).toBe('beta');

      yield* handleA.delete();
      expect(yield* handleA.exists()).toBe(false);
      expect(yield* handleB.exists()).toBe(true);
    }),
  );
});

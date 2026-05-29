import { it, expect } from '@effect/vitest';
import { Cause, Context, Effect, Fiber, Layer, Stream } from 'effect';
import { type Adapter, FilesError } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { Storage, layer } from '../src/service.js';
import { StorageAdapter } from '../src/adapter.js';
import { StorageProviderError } from '../src/errors.js';
import type { UploadOptions } from '../src/service-types.js';

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = layer().pipe(Layer.provide(Layer.succeed(StorageAdapter, memory())));

// ── Helpers ───────────────────────────────────────────────────────────

/** Read a downloaded StoredFile as text. */
const readText = (file: { text(): Promise<string> }) => Effect.promise(() => file.text());

/** Execute an upload and unwrap the deferred result, ignoring progress. */
const runUpload = (
  svc: Context.Tag.Service<typeof Storage>,
  key: string,
  body: string,
  opts?: UploadOptions,
) => svc.upload(key, body, opts).pipe(Effect.flatMap(({ result }) => result));

// ═════════════════════════════════════════════════════════════════════
// Storage service tests (memory-backed)
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)('Storage', (it) => {
  // ── Upload / download roundtrip ──────────────────────────────────

  it.scoped('upload → download roundtrip', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'hello.txt', 'Hello, world!');
      const file = yield* svc.download('hello.txt');
      const text = yield* readText(file);
      expect(text).toBe('Hello, world!');
    }),
  );

  it.scoped('upload → head returns metadata', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'meta.txt', 'metadata test');
      const entry = yield* svc.head('meta.txt');
      expect(entry.key).toBe('meta.txt');
      expect(entry.size).toBeGreaterThan(0);
    }),
  );

  // ── exists ───────────────────────────────────────────────────────

  it.scoped('exists returns true for existing key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'present.txt', 'here');
      const yes = yield* svc.exists('present.txt');
      expect(yes).toBe(true);
    }),
  );

  it.scoped('exists returns false for missing key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const no = yield* svc.exists('ghost.txt');
      expect(no).toBe(false);
    }),
  );

  // ── delete ───────────────────────────────────────────────────────

  it.scoped('delete removes the key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'remove-me.txt', 'gone soon');
      yield* svc.delete('remove-me.txt');
      const exists = yield* svc.exists('remove-me.txt');
      expect(exists).toBe(false);
    }),
  );

  // ── copy ─────────────────────────────────────────────────────────

  it.scoped('copy duplicates a key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'original.txt', 'original');
      yield* svc.copy('original.txt', 'duplicate.txt');

      const a = yield* svc.download('original.txt');
      const b = yield* svc.download('duplicate.txt');

      expect(yield* readText(a)).toBe('original');
      expect(yield* readText(b)).toBe('original');
    }),
  );

  // ── move ─────────────────────────────────────────────────────────

  it.scoped('move re-keys a file', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'src.txt', 'move test');
      yield* svc.move('src.txt', 'dst.txt');

      expect(yield* svc.exists('src.txt')).toBe(false);
      expect(yield* svc.exists('dst.txt')).toBe(true);

      const file = yield* svc.download('dst.txt');
      expect(yield* readText(file)).toBe('move test');
    }),
  );

  // ── list ─────────────────────────────────────────────────────────

  it.scoped('list with prefix returns matching keys', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'srv-a.txt', 'a');
      yield* runUpload(svc, 'srv-b.txt', 'b');

      const result = yield* svc.list({ prefix: 'srv-' });
      const keys = result.items.map((i) => i.key).sort();
      expect(keys).toEqual(['srv-a.txt', 'srv-b.txt']);
    }),
  );

  // ── Upload progress stream ───────────────────────────────────────

  it.scoped('upload reports progress via the returned stream', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const { result, progress } = yield* svc.upload('big.dat', 'some data');

      const events: { loaded: number; total: number | undefined }[] = [];
      yield* Stream.runForEach(progress, (p) =>
        Effect.sync(() => {
          events.push({ loaded: p.loaded, total: p.total });
        }),
      ).pipe(Effect.forkScoped);

      yield* result;

      expect(events.length).toBeGreaterThanOrEqual(1);
      // Last event should have loaded === total (buffered body)
      const last = events[events.length - 1]!;
      expect(last.loaded).toBe(last.total);
    }),
  );

  // ── Error mapping ────────────────────────────────────────────────

  it.scoped('download of missing key fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.download('nope.nope'));
      expect(outcome._tag).toBe('Failure');
      if (outcome._tag !== 'Failure') return;

      const failure = Cause.failureOption(outcome.cause);
      expect(failure._tag).toBe('Some');
      if (failure._tag === 'Some') {
        // The memory adapter surfaces "not found" as FilesError("Provider"),
        // which maps to StorageProviderError. Exact error-code mapping is
        // exhaustively tested in errors.test.ts — this test only verifies
        // that errors flow through the service pipeline end-to-end.
        expect(failure.value._tag).toBe('StorageProviderError');
      }
    }),
  );

  // ── url ──────────────────────────────────────────────────────────

  it.scoped('url returns a string for an existing key', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, 'url-test.txt', 'content');
      const result = yield* svc.url('url-test.txt');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }),
  );

  // ── signedUploadUrl ──────────────────────────────────────────────

  it.scoped('signedUploadUrl returns a valid SignedUpload shape', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const result = yield* svc.signedUploadUrl('upload-me.txt', {
        expiresIn: 3600,
        contentType: 'text/plain',
      });
      expect(result.url).toBeDefined();
      expect(typeof result.url).toBe('string');
    }),
  );

  // ── Cancellation ─────────────────────────────────────────────────
  //
  // The deferred result Effect is what actually performs the upload,
  // so cancellation targets that inner Effect.

  it.scoped('upload is cancellable', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const { result } = yield* svc.upload('cancel-me.txt', 'data');
      const fiber = yield* Effect.fork(result);
      yield* Fiber.interrupt(fiber);
      const outcome = yield* Effect.exit(Fiber.join(fiber));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  // ── Error paths (memory adapter) ─────────────────────────────────

  it.scoped('head on non-existent key fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.head('no-such-key'));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  it.scoped('copy with missing source fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.copy('missing.txt', 'dest.txt'));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  it.scoped('move with missing source fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.move('gone.txt', 'dst.txt'));
      expect(outcome._tag).toBe('Failure');
    }),
  );
});

// ── Error-path layer (deliberately-failing adapter) ───────────────────
//
// Provides a Storage service backed by an adapter that throws on every
// operation, ensuring error mapping flows end-to-end for all methods.

const allThrow = (): never => {
  throw new FilesError('Provider', 'bad adapter');
};

const badAdapter = {
  name: 'bad-adapter',
  raw: null,
  reportsUploadProgress: false,
  supportsRange: false,
  upload: allThrow,
  download: allThrow,
  head: allThrow,
  exists: allThrow,
  delete: allThrow,
  copy: allThrow,
  list: allThrow,
  url: allThrow,
  signedUploadUrl: allThrow,
} satisfies Adapter;

const BadAdapterLayer = layer().pipe(Layer.provide(Layer.succeed(StorageAdapter, badAdapter)));

it.layer(BadAdapterLayer)('Storage errors (bad adapter)', (it) => {
  it.scoped('delete on missing key fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.delete('any-key'));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  it.scoped('list when adapter throws fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.list());
      expect(outcome._tag).toBe('Failure');
      if (outcome._tag === 'Failure') {
        const failure = Cause.failureOption(outcome.cause);
        expect(failure._tag).toBe('Some');
        if (failure._tag === 'Some') {
          expect(failure.value).toBeInstanceOf(StorageProviderError);
        }
      }
    }),
  );

  it.scoped('url when adapter throws fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.url('any-key'));
      expect(outcome._tag).toBe('Failure');
    }),
  );

  it.scoped('signedUploadUrl when adapter throws fails with a StorageError', () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.signedUploadUrl('any-key', { expiresIn: 3600 }));
      expect(outcome._tag).toBe('Failure');
    }),
  );
});

import { it, expect } from '@effect/vitest';
import { Effect, Stream } from 'effect';
import { NodeContext } from '@effect/platform-node';
import { FileSystem, Path } from '@effect/platform';
import { watch, WatchEvent } from '../src/index.js';
import type { WatchError } from '../src/errors.js';

// ── Layer setup ──────────────────────────────────────────────────────

const TestLayer = NodeContext.layer;

// ── Helpers ─────────────────────────────────────────────────────────

/** Take the first N events from the stream with a timeout. */
const takeEvents = (stream: Stream.Stream<WatchEvent, WatchError>, n: number) =>
  stream.pipe(
    Stream.take(n),
    Stream.runCollect,
    Effect.map((chunk) => Array.from(chunk)),
    Effect.timeout('5 seconds'),
  );

// ── Tests ────────────────────────────────────────────────────────────

it.layer(TestLayer)('watch', (it) => {
  it.scoped('returns a controller with stream, ready, add, unwatch', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const { stream, ready, add, unwatch } = yield* watch(dir, {
        ignoreInitial: true,
      });

      expect(typeof stream).toBe('function');
      expect(typeof add).toBe('function');
      expect(typeof unwatch).toBe('function');

      // ready should resolve quickly on an empty directory
      yield* ready;
    }),
  );

  it.scoped('ready resolves after initial scan completes', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });

      // Seed a file before watching
      const seededPath = path.join(dir, 'seeded.txt');
      yield* fs.writeFileString(seededPath, 'seed');

      const { ready } = yield* watch(dir, { ignoreInitial: false });
      yield* ready;
    }),
  );

  it.scoped('emits add event when a file is created', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const { stream, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      // Subscribe before the file change so the handler is registered
      const fiber = yield* Effect.fork(takeEvents(stream('add'), 1));

      const filePath = path.join(dir, 'new-file.txt');
      yield* fs.writeFileString(filePath, 'hello');

      const events = yield* fiber;
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(WatchEvent);
      expect(events[0].event).toBe('add');
      expect(events[0].path).toBe(filePath);
    }),
  );

  it.scoped('emits change event when a file is modified', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const { stream, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      // Subscribe before any file changes
      const fiber = yield* Effect.fork(takeEvents(stream('all'), 2));

      const filePath = path.join(dir, 'watch-me.txt');
      yield* fs.writeFileString(filePath, 'initial');
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 200)));
      yield* fs.writeFileString(filePath, ' modified', { flag: 'a' });

      const events = yield* fiber;
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('add');
      expect(events[1].event).toBe('change');
      expect(events[1].path).toBe(filePath);
    }),
  );

  it.scoped('emits unlink event when a file is deleted', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const { stream, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      // Subscribe before any file changes
      const fiber = yield* Effect.fork(takeEvents(stream('all'), 2));

      const filePath = path.join(dir, 'delete-me.txt');
      yield* fs.writeFileString(filePath, 'bye');
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 200)));
      yield* fs.remove(filePath);

      const events = yield* fiber;
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('add');
      expect(events[1].event).toBe('unlink');
      expect(events[1].path).toBe(filePath);
    }),
  );

  it.scoped('subscribing to a single event filters out other chokidar events', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const filePath = path.join(dir, 'test.txt');

      const { stream, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      // Subscribe to 'change' before any file ops — 'add' will be invisible
      const fiber = yield* Effect.fork(takeEvents(stream('change'), 1));

      yield* fs.writeFileString(filePath, 'hello');
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 200)));
      yield* fs.writeFileString(filePath, ' appended', { flag: 'a' });

      const events = yield* fiber;
      expect(events[0].event).toBe('change');
      expect(events[0].path).toBe(filePath);
    }),
  );

  it.scoped('stream("all") yields every event regardless of type', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });
      const filePath = path.join(dir, 'target.txt');

      const { stream, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      // Subscribe before any file ops
      const fiber = yield* Effect.fork(takeEvents(stream('all'), 2));

      yield* fs.writeFileString(filePath, 'v1');
      yield* Effect.promise(() => new Promise((r) => setTimeout(r, 200)));
      yield* fs.writeFileString(filePath, 'v2', { flag: 'a' });

      const events = yield* fiber;
      expect(events[0].event).toBe('add');
      expect(events[1].event).toBe('change');
    }),
  );

  it.scoped('dynamic add accepts new paths', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });

      const { stream, add, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      yield* add(path.join(dir, 'added'));

      const fiber = yield* Effect.fork(takeEvents(stream('add'), 1));

      const filePath = path.join(dir, 'regular.txt');
      yield* fs.writeFileString(filePath, 'hello');

      const events = yield* fiber;
      expect(events[0].path).toBe(filePath);
    }),
  );

  it.scoped('dynamic unwatch accepts paths', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });

      const { stream, unwatch, ready } = yield* watch(dir, { ignoreInitial: true });
      yield* ready;

      yield* unwatch(path.join(dir, 'ignored.txt'));

      const fiber = yield* Effect.fork(takeEvents(stream('add'), 1));

      const filePath = path.join(dir, 'active.txt');
      yield* fs.writeFileString(filePath, 'hello');

      const events = yield* fiber;
      expect(events[0].path).toBe(filePath);
    }),
  );

  it.scoped('getWatched returns a record of watched directories', () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: 'watch-test-' });

      // Seed a file so the directory is non-empty
      yield* fs.writeFileString(path.join(dir, 'a.txt'), 'x');

      const { getWatched, ready } = yield* watch(dir, { ignoreInitial: false });
      yield* ready;

      const watched = yield* getWatched;
      expect(typeof watched).toBe('object');
      expect(Object.keys(watched).length).toBeGreaterThanOrEqual(1);
    }),
  );
});

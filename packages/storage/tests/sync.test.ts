import { it, expect } from '@effect/vitest';
import { Effect, Layer, Stream } from 'effect';
import { Files, type SyncProgress } from 'files-sdk';
import { memory } from 'files-sdk/memory';
import * as Sync from '../src/features/sync.js';

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = Layer.empty;

// ═════════════════════════════════════════════════════════════════════
// Sync — empty source
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)('Sync', (it) => {
  it.scoped('empty source → empty result', () =>
    Effect.gen(function* () {
      const src = new Files({ adapter: memory() });
      const dst = new Files({ adapter: memory() });

      const result = yield* Sync.sync(src, dst).pipe(Effect.flatMap(({ result }) => result));

      expect(result.uploaded).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.deleted).toBeUndefined();
      expect(result.errors).toBeUndefined();
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — syncs files
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('syncs files from source to destination', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: { 'a.txt': 'hello a', 'b.txt': 'hello b' },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const result = yield* Sync.sync(src, dst).pipe(Effect.flatMap(({ result }) => result));

      expect(result.uploaded).toHaveLength(2);
      expect(result.uploaded).toContain('a.txt');
      expect(result.uploaded).toContain('b.txt');

      // Files landed in destination
      const file = yield* Effect.promise(() => dst.download('a.txt'));
      expect(yield* Effect.promise(() => file.text())).toBe('hello a');
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — skips unchanged keys
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('skips keys already identical at destination', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({ initial: { 'k.txt': 'same' } }),
      });
      const dst = new Files({
        adapter: memory({ initial: { 'k.txt': 'same' } }),
      });

      const result = yield* Sync.sync(src, dst).pipe(Effect.flatMap(({ result }) => result));

      expect(result.uploaded).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped).toContain('k.txt');
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — prune
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('prune deletes destination keys not in source', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({ initial: { 'a.txt': 'hello' } }),
      });
      const dst = new Files({
        adapter: memory({ initial: { 'a.txt': 'hello', 'orphan.txt': 'bye' } }),
      });

      const result = yield* Sync.sync(src, dst, { prune: true }).pipe(
        Effect.flatMap(({ result }) => result),
      );

      expect(result.uploaded).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.deleted).toBeDefined();
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted).toContain('orphan.txt');
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — dry run
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('dry run returns plan without mutating destination', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({ initial: { 'n.txt': 'new' } }),
      });
      const dst = new Files({ adapter: memory() });

      const result = yield* Sync.sync(src, dst, { dryRun: true }).pipe(
        Effect.flatMap(({ result }) => result),
      );

      expect(result.uploaded).toHaveLength(1);
      expect(result.uploaded).toContain('n.txt');

      // Destination should be untouched
      const exists = yield* Effect.promise(() => dst.exists('n.txt'));
      expect(exists).toBe(false);
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — progress events
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('reports progress events during sync', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: { 'x.txt': 'content x', 'y.txt': 'content y' },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const { result, progress } = yield* Sync.sync(src, dst);
      const events: SyncProgress[] = [];

      yield* Stream.runForEach(progress, (p) =>
        Effect.sync(() => {
          events.push(p);
        }),
      ).pipe(Effect.forkScoped);

      yield* result;

      expect(events.length).toBeGreaterThanOrEqual(2);

      const last = events[events.length - 1]!;
      expect(last.done).toBe(last.total);
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Sync — prefix scoping
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('prefix scopes the sync to a subdirectory', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: {
            'uploads/a.txt': 'a',
            'uploads/b.txt': 'b',
            'other/c.txt': 'c',
          },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const result = yield* Sync.sync(src, dst, { prefix: 'uploads/' }).pipe(
        Effect.flatMap(({ result }) => result),
      );

      expect(result.uploaded).toHaveLength(2);
      expect(result.uploaded).toContain('uploads/a.txt');
      expect(result.uploaded).toContain('uploads/b.txt');
    }),
  );
});

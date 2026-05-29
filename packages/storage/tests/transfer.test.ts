import { it, expect } from "@effect/vitest";
import { Cause, Deferred, Effect, Fiber, Layer, Stream } from "effect";
import { Files, FilesError } from "files-sdk";
import { memory } from "files-sdk/memory";
import * as Transfer from "../src/features/transfer.js";
import { StorageNotFoundError } from "../src/index.js";

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = Layer.empty;

// ── Helpers ───────────────────────────────────────────────────────────

/** Collect all events from a progress stream (must be forked before transfer starts). */
const collectProgress = (
  stream: Stream.Stream<unknown, unknown, never>,
): Effect.Effect<Array<unknown>, unknown> =>
  stream.pipe(Stream.runCollect, Effect.map((c) => Array.from(c)));

// ═════════════════════════════════════════════════════════════════════
// Transfer — empty source
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)("Transfer", (it) => {
  it.scoped("empty source → empty result (no progress events)", () =>
    Effect.gen(function* () {
      const src = new Files({ adapter: memory() });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);

      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      const result = yield* Deferred.await(done);
      const events = yield* Fiber.join(eventsFiber);

      expect(events).toHaveLength(0);
      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toBeUndefined();
      expect(result.errors).toBeUndefined();
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — files with progress
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("transfers files and reports progress events", () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: {
            "a.txt": "hello a",
            "b.txt": "hello b",
            "c.txt": "hello c",
          },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);

      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      const result = yield* Deferred.await(done);
      const events = yield* Fiber.join(eventsFiber);

      expect(events.length).toBeGreaterThanOrEqual(1);

      // Last event should report done === total
      const last = events[events.length - 1] as Record<string, unknown>;
      expect(last.done).toBe(last.total);
      expect(result.transferred).toHaveLength(3);
      expect(result.transferred).toContain("a.txt");
      expect(result.transferred).toContain("b.txt");
      expect(result.transferred).toContain("c.txt");
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — progress event shape
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("progress events have correct shape", () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: { "x.txt": "content" },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);

      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      yield* Deferred.await(done);
      const events = yield* Fiber.join(eventsFiber);

      expect(events.length).toBe(1);
      const p = events[0] as Record<string, unknown>;
      expect(p.done).toBe(1);
      expect(p.total).toBe(1);
      expect(p.key).toBe("x.txt");
      expect(["transferred", "skipped"]).toContain(p.status);
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — deferred resolves with result
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("deferred resolves with TransferResult on completion", () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({
          initial: {
            "data/1.json": "{}",
            "data/2.json": "{}",
          },
        }),
      });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);

      // Consume the stream so the transfer actually starts
      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      const result = yield* Deferred.await(done);
      yield* Fiber.join(eventsFiber);

      expect(result.transferred).toHaveLength(2);
      expect(result.skipped).toBeUndefined();
      expect(result.errors).toBeUndefined();
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — files land in the destination
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("transferred files land in the destination adapter", () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({ initial: { "report.pdf": "PDF data" } }),
      });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);
      // consume the stream so transfer kicks off
      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      yield* Deferred.await(done);
      yield* Fiber.join(eventsFiber);

      // Directly inspect the destination's memory store
      const entry = dst.adapter.raw.get("report.pdf");
      expect(entry).toBeDefined();
      expect(entry?.contentType).toBeDefined();
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — overwrite
  // ═══════════════════════════════════════════════════════════════════

  it.scoped('overwrite: false skips existing keys', () =>
    Effect.gen(function* () {
      const src = new Files({
        adapter: memory({ initial: { "k.txt": "new data" } }),
      });
      const dst = new Files({
        adapter: memory({ initial: { "k.txt": "old data" } }),
      });

      const { progress, done } = yield* Transfer.transfer(src, dst, {
        overwrite: false,
      });

      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      const result = yield* Deferred.await(done);
      yield* Fiber.join(eventsFiber);

      expect(result.skipped).toBeDefined();
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped).toContain("k.txt");
      expect(result.transferred).toHaveLength(0);

      // Old data should still be there
      const entry = dst.adapter.raw.get("k.txt");
      expect(entry).toBeDefined();
      // Memory adapter doesn't store string representation directly;
      // the body was "old data"
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — error mapping
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("maps FilesError to StorageError on transfer failure", () =>
    Effect.gen(function* () {
      // Source list explodes — should surface as tagged StorageError
      const badAdapter = {
        name: "explosive-src",
        raw: null,
        move: undefined as unknown,
        reportsUploadProgress: false,
        supportsRange: false,
        upload: () => Promise.reject(new Error("no")),
        download: () => Promise.reject(new Error("no")),
        head: () => Promise.reject(new Error("no")),
        exists: () => Promise.reject(new Error("no")),
        delete: () => Promise.reject(new Error("no")),
        copy: () => Promise.reject(new Error("no")),
        list: () => Promise.reject(new FilesError("NotFound", "bucket gone")),
        url: () => Promise.reject(new Error("no")),
        signedUploadUrl: () => Promise.reject(new Error("no")),
      };
      const src = new Files({ adapter: badAdapter as never });
      const dst = new Files({ adapter: memory() });

      const { progress, done } = yield* Transfer.transfer(src, dst);

      const eventsFiber = yield* Effect.fork(collectProgress(progress));
      const outcome = yield* Effect.exit(Deferred.await(done));
      yield* Fiber.interrupt(eventsFiber);

      // The deferred should fail with a StorageError
      expect(outcome._tag).toBe("Failure");
      if (outcome._tag === "Failure") {
        const failure = Cause.failureOption(outcome.cause);
        expect(failure._tag).toBe("Some");
        if (failure._tag === "Some") {
          expect(failure.value).toBeInstanceOf(StorageNotFoundError);
        }
      }
    }),
  );
});

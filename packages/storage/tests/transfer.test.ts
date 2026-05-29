import { it, expect } from "@effect/vitest";
import { Cause, Effect, Layer, Stream } from "effect";
import { type Adapter, Files, FilesError, TransferProgress } from "files-sdk";
import { memory } from "files-sdk/memory";
import * as Transfer from "../src/features/transfer.js";
import { StorageNotFoundError } from "../src/index.js";

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = Layer.empty;

// ── Helpers ───────────────────────────────────────────────────────────

/** Execute a transfer and return the resolved TransferResult, ignoring progress. */
const runTransfer = (
  src: Files,
  dst: Files,
  opts?: Transfer.TransferOptions,
) =>
  Transfer.transfer(src, dst, opts).pipe(
    Effect.flatMap(({ result }) => result),
  );

// ═════════════════════════════════════════════════════════════════════
// Transfer — empty source
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)("Transfer", (it) => {
  it.scoped("empty source → empty result", () =>
    Effect.gen(function* () {
      const src = new Files({ adapter: memory() });
      const dst = new Files({ adapter: memory() });

      const result = yield* runTransfer(src, dst);

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

      const { result, progress } = yield* Transfer.transfer(src, dst);
      const events: TransferProgress[] = [];

      // Fork the progress collector before starting the transfer
      yield* Stream.runForEach(progress, (p) =>
        Effect.sync(() => {
          events.push(p);
        }),
      ).pipe(Effect.forkScoped);

      const transferResult = yield* result;

      expect(events.length).toBeGreaterThanOrEqual(1);

      // Last event should report done === total
      const last = events[events.length - 1]!;
      expect(last.done).toBe(last.total);
      expect(transferResult.transferred).toHaveLength(3);
      expect(transferResult.transferred).toContain("a.txt");
      expect(transferResult.transferred).toContain("b.txt");
      expect(transferResult.transferred).toContain("c.txt");
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

      const { result, progress } = yield* Transfer.transfer(src, dst);
      const events: TransferProgress[] = [];

      yield* Stream.runForEach(progress, (p) =>
        Effect.sync(() => {
          events.push(p);
        }),
      ).pipe(Effect.forkScoped);

      yield* result;

      expect(events.length).toBe(1);
      const p = events[0]!;
      expect(p.done).toBe(1);
      expect(p.total).toBe(1);
      expect(p.key).toBe("x.txt");
      expect(["transferred", "skipped"]).toContain(p.status);
    }),
  );

  // ═══════════════════════════════════════════════════════════════════
  // Transfer — resolves with TransferResult on completion
  // ═══════════════════════════════════════════════════════════════════

  it.scoped("resolves with TransferResult on completion", () =>
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

      const result = yield* runTransfer(src, dst);

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

      yield* runTransfer(src, dst);

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

      const result = yield* runTransfer(src, dst, { overwrite: false });

      expect(result.skipped).toBeDefined();
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped).toContain("k.txt");
      expect(result.transferred).toHaveLength(0);

      // Old data should still be there
      const oldFile = yield* Effect.promise(() => dst.download("k.txt"));
      expect(yield* Effect.promise(() => oldFile.text())).toBe("old data");
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
      const src = new Files({ adapter: badAdapter as unknown as Adapter });
      const dst = new Files({ adapter: memory() });

      // Transfer setup succeeds (outer effect), error is in the deferred result
      const { result } = yield* Transfer.transfer(src, dst);
      const outcome = yield* Effect.exit(result);

      // The deferred result should fail with a StorageError
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

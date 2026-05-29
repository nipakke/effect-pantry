import { it, expect } from "@effect/vitest";
import { Chunk, Context, Effect, Fiber, Layer, Stream } from "effect";
import type { FilesActionEvent, FilesErrorEvent } from "files-sdk";
import { memory } from "files-sdk/memory";
import { Storage, layer } from "../src/service.js";
import type { UploadOptions } from "../src/service-types.js";
import { StorageAdapter } from "../src/adapter.js";

/** Execute an upload and unwrap the deferred result, ignoring progress. */
const runUpload = (
  svc: Context.Tag.Service<typeof Storage>,
  key: string,
  body: string,
  opts?: UploadOptions,
) =>
  svc.upload(key, body, opts).pipe(
    Effect.flatMap(({ result }) => result),
  );

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = layer().pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
);

/** Fork a stream consumer that captures the first hook event. */
const captureFirst = <A, E>(stream: Stream.Stream<A, E>) =>
  stream.pipe(Stream.take(1), Stream.runCollect, Effect.forkScoped);

// ═════════════════════════════════════════════════════════════════════
// Hook stream tests (memory-backed)
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)("hookStream", (it) => {
  // ── onAction (success) ───────────────────────────────────────────

  it.scoped("onAction fires on upload success", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const fiber = yield* captureFirst(svc.hookStream("onAction"));
      yield* runUpload(svc, "hook-upload.txt", "hello");

      const chunk = yield* Fiber.join(fiber);
      expect(Chunk.size(chunk)).toBe(1);
    }),
  );

  // ── onAction (failure) ───────────────────────────────────────────

  it.scoped("onAction fires with status=error on missing download", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const fiber = yield* captureFirst(svc.hookStream("onAction"));

      yield* Effect.exit(svc.download("nonexistent.txt"));

      const chunk = yield* Fiber.join(fiber);
      const event = Chunk.unsafeHead(chunk) as FilesActionEvent;
      expect(event.type).toBe("download");
      expect(event.status).toBe("error");
      expect(event.key).toBe("nonexistent.txt");
    }),
  );

  // ── onError ──────────────────────────────────────────────────────

  it.scoped("onError fires on download failure", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const fiber = yield* captureFirst(svc.hookStream("onError"));

      yield* Effect.exit(svc.download("ghost.txt"));

      const chunk = yield* Fiber.join(fiber);
      const event = Chunk.unsafeHead(chunk) as FilesErrorEvent;
      expect(event.type).toBe("download");
      expect(event.key).toBe("ghost.txt");
      expect(event.error).toBeDefined();
    }),
  );

  // ── Multiple subscribers ─────────────────────────────────────────

  it.scoped("multiple subscribers receive events independently", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;

      const f1 = yield* captureFirst(svc.hookStream("onAction"));
      const f2 = yield* captureFirst(svc.hookStream("onAction"));

      yield* runUpload(svc, "multi-sub.txt", "shared");

      const [a, b] = yield* Effect.all(
        [Fiber.join(f1), Fiber.join(f2)],
        { concurrency: "unbounded" },
      );
      expect(Chunk.size(a)).toBe(1);
      expect(Chunk.size(b)).toBe(1);
    }),
  );

  // ── onAction carries per-method shape ────────────────────────────

  it.scoped("onAction copy reports from/to instead of key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* runUpload(svc, "copy-src.txt", "source");

      const fiber = yield* captureFirst(svc.hookStream("onAction"));
      yield* svc.copy("copy-src.txt", "copy-dst.txt");

      const chunk = yield* Fiber.join(fiber);
      const event = Chunk.unsafeHead(chunk) as FilesActionEvent;
      expect(event.type).toBe("copy");
      expect(event.from).toBe("copy-src.txt");
      expect(event.to).toBe("copy-dst.txt");
    }),
  );
});

import { it, expect } from "@effect/vitest";
import { Cause, Effect, Fiber, Layer } from "effect";
import { memory } from "files-sdk/memory";
import {
  Storage,
  layer,
} from "../src/service.js";
import { StorageAdapter } from "../src/adapter.js";

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = layer.pipe(
  Layer.provide(Layer.succeed(StorageAdapter, memory())),
);

// ── Helpers ───────────────────────────────────────────────────────────

/** Read a downloaded StoredFile as text. */
const readText = (file: { text(): Promise<string> }) =>
  Effect.promise(() => file.text());

// ═════════════════════════════════════════════════════════════════════
// Storage service tests (memory-backed)
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)("Storage", (it) => {
  // ── Upload / download roundtrip ──────────────────────────────────

  it.scoped("upload → download roundtrip", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("hello.txt", "Hello, world!");
      const file = yield* svc.download("hello.txt");
      const text = yield* readText(file);
      expect(text).toBe("Hello, world!");
    }),
  );

  it.scoped("upload → head returns metadata", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("meta.txt", "metadata test");
      const entry = yield* svc.head("meta.txt");
      expect(entry.key).toBe("meta.txt");
      expect(entry.size).toBeGreaterThan(0);
    }),
  );

  // ── exists ───────────────────────────────────────────────────────

  it.scoped("exists returns true for existing key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("present.txt", "here");
      const yes = yield* svc.exists("present.txt");
      expect(yes).toBe(true);
    }),
  );

  it.scoped("exists returns false for missing key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const no = yield* svc.exists("ghost.txt");
      expect(no).toBe(false);
    }),
  );

  // ── delete ───────────────────────────────────────────────────────

  it.scoped("delete removes the key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("remove-me.txt", "gone soon");
      yield* svc.delete("remove-me.txt");
      const exists = yield* svc.exists("remove-me.txt");
      expect(exists).toBe(false);
    }),
  );

  // ── copy ─────────────────────────────────────────────────────────

  it.scoped("copy duplicates a key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("original.txt", "original");
      yield* svc.copy("original.txt", "duplicate.txt");

      const a = yield* svc.download("original.txt");
      const b = yield* svc.download("duplicate.txt");

      expect(yield* readText(a)).toBe("original");
      expect(yield* readText(b)).toBe("original");
    }),
  );

  // ── move ─────────────────────────────────────────────────────────

  it.scoped("move re-keys a file", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("src.txt", "move test");
      yield* svc.move("src.txt", "dst.txt");

      expect(yield* svc.exists("src.txt")).toBe(false);
      expect(yield* svc.exists("dst.txt")).toBe(true);

      const file = yield* svc.download("dst.txt");
      expect(yield* readText(file)).toBe("move test");
    }),
  );

  // ── list ─────────────────────────────────────────────────────────

  it.scoped("list with prefix returns matching keys", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("srv-a.txt", "a");
      yield* svc.upload("srv-b.txt", "b");

      const result = yield* svc.list({ prefix: "srv-" });
      const keys = result.items.map((i) => i.key).sort();
      expect(keys).toEqual(["srv-a.txt", "srv-b.txt"]);
    }),
  );

  // ── Error mapping ────────────────────────────────────────────────

  it.scoped("download of missing key fails with a StorageError", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const outcome = yield* Effect.exit(svc.download("nope.nope"));
      expect(outcome._tag).toBe("Failure");
      if (outcome._tag !== "Failure") return;

      const failure = Cause.failureOption(outcome.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        // The memory adapter surfaces "not found" as FilesError("Provider"),
        // which maps to StorageProviderError. Exact error-code mapping is
        // exhaustively tested in errors.test.ts — this test only verifies
        // that errors flow through the service pipeline end-to-end.
        expect(failure.value._tag).toBe("StorageProviderError");
      }
    }),
  );

  // ── url ──────────────────────────────────────────────────────────

  it.scoped("url returns a string for an existing key", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      yield* svc.upload("url-test.txt", "content");
      const result = yield* svc.url("url-test.txt");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }),
  );

  // ── signedUploadUrl ──────────────────────────────────────────────

  it.scoped("signedUploadUrl returns a valid SignedUpload shape", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const result = yield* svc.signedUploadUrl("upload-me.txt", {
        expiresIn: 3600,
        contentType: "text/plain",
      });
      expect(result.url).toBeDefined();
      expect(typeof result.url).toBe("string");
    }),
  );

  // ── Cancellation ─────────────────────────────────────────────────

  it.scoped("upload is cancellable", () =>
    Effect.gen(function* () {
      const svc = yield* Storage;
      const fiber = yield* Effect.fork(svc.upload("cancel-me.txt", "data"));
      yield* Fiber.interrupt(fiber);
      const outcome = yield* Effect.exit(Fiber.join(fiber));
      expect(outcome._tag).toBe("Failure");
    }),
  );
});

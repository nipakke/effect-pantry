/**
 * Integration tests using the filesystem adapter.
 *
 * These tests touch the real filesystem inside a temporary directory.
 * They are skipped by default and can be enabled on demand:
 *
 *   RUN_INTEGRATION=true pnpm --filter @effect-pantry/storage test
 *
 * @module
 */

import { it, expect } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fs } from "files-sdk/fs";
import { Storage, layer } from "../src/service.js";
import { StorageAdapter } from "../src/adapter.js";

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a temp directory, returning its path. */
const createTempDir = () =>
  mkdtemp(join(tmpdir(), "effect-pantry-storage-test-"));

/** Remove a directory and all its contents. */
const removeDir = (dir: string) => rm(dir, { recursive: true, force: true });

/** Read a downloaded StoredFile as text. */
const readText = (file: { text(): Promise<string> }) =>
  Effect.promise(() => file.text());

/** Execute an upload and unwrap the deferred result. */
const runUpload = (
  svc: Context.Tag.Service<typeof Storage>,
  key: string,
  body: string,
) =>
  svc.upload(key, body).pipe(
    Effect.flatMap(({ result }) => result),
  );

// ── Layer factory ─────────────────────────────────────────────────────

const makeFsLayer = (root: string) =>
  layer.pipe(
    Layer.provide(Layer.succeed(StorageAdapter, fs({ root }))),
  );

// ═════════════════════════════════════════════════════════════════════
// Fs adapter integration (skipped by default)
// ═════════════════════════════════════════════════════════════════════

const isIntegration = process.env.RUN_INTEGRATION === "true";

it.layer(Layer.empty)("Fs adapter", (it) => {
  it.scoped.skipIf(!isIntegration)(
    "upload → download roundtrip via filesystem",
    () =>
      Effect.gen(function* () {
        const tmpDir = yield* Effect.promise(() => createTempDir());
        yield* Effect.addFinalizer(() => Effect.promise(() => removeDir(tmpDir)));

        const TestLayer = makeFsLayer(tmpDir);
        const svc = yield* Storage.pipe(Effect.provide(TestLayer));

        yield* runUpload(svc, "hello.txt", "Hello from fs adapter!");
        const file = yield* svc.download("hello.txt");
        const text = yield* readText(file);

        expect(text).toBe("Hello from fs adapter!");
      }),
  );

  it.scoped.skipIf(!isIntegration)(
    "download missing key returns StorageError (NotFound for fs)",
    () =>
      Effect.gen(function* () {
        const tmpDir = yield* Effect.promise(() => createTempDir());
        yield* Effect.addFinalizer(() => Effect.promise(() => removeDir(tmpDir)));

        const TestLayer = makeFsLayer(tmpDir);
        const svc = yield* Storage.pipe(Effect.provide(TestLayer));

        const outcome = yield* Effect.exit(svc.download("no-such-file.txt"));
        expect(outcome._tag).toBe("Failure");
      }),
  );

  it.scoped.skipIf(!isIntegration)(
    "exists returns false for missing key via filesystem",
    () =>
      Effect.gen(function* () {
        const tmpDir = yield* Effect.promise(() => createTempDir());
        yield* Effect.addFinalizer(() => Effect.promise(() => removeDir(tmpDir)));

        const TestLayer = makeFsLayer(tmpDir);
        const svc = yield* Storage.pipe(Effect.provide(TestLayer));

        const exists = yield* svc.exists("ghost-file.txt");
        expect(exists).toBe(false);
      }),
  );
});

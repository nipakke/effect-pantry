import * as FilesSDK from "files-sdk";
import { Deferred, Effect, Stream } from "effect";
import { toStorageError, type StorageError } from "../errors.js";

/** Options for {@link transfer}, with `signal` and `onProgress` managed internally. */
type TransferOptions = Omit<
  FilesSDK.TransferOptions,
  "signal" | "onProgress"
>;

/**
 * Cross-provider migration: walks every object the `source` exposes and
 * streams each one straight to `dest`, whatever the backends are.
 *
 * Returns a {@link Stream} of progress events and a {@link Deferred} that
 * resolves with the final result on completion (or fails on error).
 *
 * Both arguments are full {@link FilesSDK.Files} instances, not raw adapters,
 * so each leg honors its own `prefix`, retries, timeouts, and hooks.
 *
 * @example
 * ```ts
 * import { s3 } from "files-sdk/s3";
 * import { r2 } from "files-sdk/r2";
 * import * as FilesSDK from "files-sdk";
 *
 * const from = new FilesSDK.Files({ adapter: s3({ bucket: "old" }) });
 * const to   = new FilesSDK.Files({ adapter: r2({ bucket: "new", ... }) });
 *
 * const { progress, done } = yield* Transfer.transfer(from, to, {
 *   prefix: "uploads/",
 * });
 *
 * // Stream progress events
 * yield* progress.pipe(Stream.runForEach(p => console.log(p.done, p.key)));
 *
 * // Await completion
 * const result = yield* Effect.flatten(Deferred.await(done));
 * ```
 */
export const transfer = (
  source: FilesSDK.Files,
  dest: FilesSDK.Files,
  opts?: TransferOptions,
) =>
  Effect.gen(function* () {
    const deferred = yield* Deferred.make<
      FilesSDK.TransferResult,
      StorageError
    >();

    const progress = Stream.asyncPush<
      FilesSDK.TransferProgress,
      StorageError
    >(
      (emit) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const controller = new AbortController();

            FilesSDK.transfer(source, dest, {
              ...opts,
              signal: controller.signal,
              onProgress: (p) => emit.single(p),
            }).then(
              (result) => {
                emit.end();
                Deferred.unsafeDone(deferred, Effect.succeed(result));
              },
              (error) => {
                const e = toStorageError(error);
                emit.fail(e);
                Deferred.unsafeDone(deferred, Effect.fail(e));
              },
            );

            return controller;
          }),
          (controller) => Effect.sync(() => controller.abort()),
        ),
      { bufferSize: 16, strategy: "dropping" },
    );

    return { progress, done: deferred };
  });

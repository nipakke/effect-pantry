import * as FilesSDK from "files-sdk";
import { Effect, Fiber, PubSub, Stream } from "effect";
import { toStorageError, type StorageError } from "../errors.js";

/** Options for {@link transfer}, with `signal` and `onProgress` managed internally. */
export type TransferOptions = Omit<
  FilesSDK.TransferOptions,
  "signal" | "onProgress"
>;

/**
 * Cross-provider migration: walks every object the `source` exposes and
 * streams each one straight to `dest`, whatever the backends are.
 *
 * The transfer starts **eagerly** — the underlying fiber is forked immediately
 * and runs independently of the progress stream. The progress stream is optional:
 * if no consumer pulls from it, the transfer still runs to completion.
 *
 * Progress events are published via a `PubSub.sliding(16)`, meaning slow
 * consumers see only the latest event; old events are dropped. The PubSub
 * shuts down when the transfer completes or fails, which ends the progress
 * stream gracefully.
 *
 * The `done` effect resolves with a {@link FilesSDK.TransferResult} on success
 * or fails with a {@link StorageError} if any error occurs.
 *
 * Both arguments are full {@link FilesSDK.Files} instances, not raw adapters,
 * so each leg honors its own `prefix`, retries, timeouts, and hooks.
 *
 * @returns A record with:
 *  - `progress`: a {@link Stream} of progress events (starts emitting only when pulled)
 *  - `done`: an {@link Effect} that resolves with the final transfer result or fails with a {@link StorageError}
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
 * // Stream progress events (optional — transfer is already running)
 * yield* progress.pipe(Stream.runForEach(p => console.log(p.done, p.key)));
 *
 * // Await completion
 * const result = yield* done;
 * ```
 */
export const transfer = (
  source: FilesSDK.Files,
  dest: FilesSDK.Files,
  opts?: TransferOptions,
) =>
  Effect.gen(function* () {
    const pubsub = yield* PubSub.sliding<FilesSDK.TransferProgress>(16);

    const fiber = yield* Effect.forkScoped(
      Effect.tryPromise({
        try: (signal) => {
          return FilesSDK.transfer(source, dest, {
            ...opts,
            signal: signal,
            onProgress: (p) => pubsub.unsafeOffer(p),
          });
        },
        catch: toStorageError,
      }).pipe(Effect.ensuring(pubsub.shutdown)),
    );

    return {
      progress: Stream.fromPubSub(pubsub),
      done: Fiber.join(fiber),
    };
  });

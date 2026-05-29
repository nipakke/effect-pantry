import { Effect, Queue, Stream } from 'effect';
import { toStorageError, type StorageError } from './errors.js';

/** @internal */
export const wrapSDKCall = <A>(fn: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({ try: fn, catch: toStorageError });

/** @internal
 *
 * Bridges a callback-style progress operation to an Effect returning both
 * a deferred result and a progress {@link Stream}. The caller consumes
 * the stream concurrently with the result — e.g. fork the stream consumer
 * then `yield*` the result.
 *
 * Progress callbacks are pushed synchronously via {@link Queue.unsafeOffer}
 * so no extra fibers are spawned per callback. The queue is shut down when
 * the result effect completes, fails, or is interrupted (via `ensuring`).
 *
 * @example
 * ```ts
 * const { result, progress } = yield* bridgeProgress((signal, onProgress) =>
 *   sdk.upload(key, body, { signal, onProgress })
 * );
 *
 * // Fork progress consumption
 * yield* Stream.runForEach(progress, (p) => Effect.log(p)).pipe(Effect.forkScoped);
 * // Await result
 * const uploadResult = yield* result;
 * ```
 */
export const bridgeProgress = <A, P>(
  fn: (signal: AbortSignal, onProgress: (progress: P) => void) => Promise<A>,
): Effect.Effect<{ result: Effect.Effect<A, StorageError>; progress: Stream.Stream<P> }, never> =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<P>();

    const result = Effect.tryPromise({
      try: (signal) =>
        fn(signal, (progress) => {
          queue.unsafeOffer(progress);
        }),
      catch: toStorageError,
    }).pipe(Effect.ensuring(queue.shutdown));

    return { result, progress: Stream.fromQueue(queue) };
  });

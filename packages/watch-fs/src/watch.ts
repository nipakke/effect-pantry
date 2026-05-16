import * as chokidar from 'chokidar';
import { Deferred, Effect, Stream } from 'effect';
import type { Scope } from 'effect';
import { WatchEvent, type WatchEventName } from './events.js';
import { toWatchError, type WatchError } from './errors.js';
import type { WatchController, WatchOptions } from './types.js';

/**
 * Watch files/directories for changes.
 *
 * Returns a `WatchController` with:
 * - `stream(event)` — subscribe to a single event type; each call
 *   independently registers its own chokidar `.on()` listener
 * - `ready` — resolves once chokidar's initial scan is complete
 * - `add` / `unwatch` — dynamically change watched paths
 * - `getWatched` — returns a record mapping directories to their files
 *
 * The underlying chokidar watcher is cleaned up when the providing
 * `Scope` closes.
 *
 * @param paths - One or more paths to watch.
 * @param options - Chokidar options forwarded as-is.
 */
export const watch = (
  paths: string | ReadonlyArray<string>,
  options?: WatchOptions,
): Effect.Effect<WatchController, never, Scope.Scope> =>
  Effect.gen(function* () {
    const readyDeferred = yield* Deferred.make<void>();

    // ── Watcher (shared by all subscribers) ─────────────────────────
    const watcher = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const w = chokidar.watch(paths as string | string[], options ?? {});
        w.once('ready', () => {
          Deferred.unsafeDone(readyDeferred, Effect.void);
        });
        return w;
      }),
      (w) => Effect.promise(() => w.close() ?? Promise.resolve()),
    );

    const ready: Effect.Effect<void> = Deferred.await(readyDeferred);

    // ── Per-event subscriptions ────────────────────────────────────
    // Every subscriber listens on chokidar's "all" event and filters
    // for the event they care about.  chokidar's "all" fires for every
    // file-system change with the child event name as the first arg.
    const stream = (event: WatchEventName): Stream.Stream<WatchEvent, WatchError> =>
      Stream.asyncPush<WatchEvent, WatchError>(
        (emit) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              const handler = (childEvent: string, path: string): void => {
                if (event === 'all' || childEvent === event) {
                  emit.single(
                    new WatchEvent({
                      event: childEvent as WatchEventName,
                      path,
                    }),
                  );
                }
              };
              watcher.on('all', handler);

              const errorHandler = (err: unknown): void => {
                emit.fail(toWatchError(err));
              };
              watcher.on('error', errorHandler);

              return { handler, errorHandler };
            }),
            ({ handler, errorHandler }) =>
              Effect.sync(() => {
                watcher.off('all', handler);
                watcher.off('error', errorHandler);
              }),
          ),
        { bufferSize: 16, strategy: 'dropping' },
      );

    // ── Dynamic path management ────────────────────────────────────
    const add = (paths: string | ReadonlyArray<string>) =>
      Effect.sync(() => {
        watcher.add(paths as string | string[]);
      });

    const unwatch = (paths: string | ReadonlyArray<string>) =>
      Effect.sync(() => {
        watcher.unwatch(paths as string | string[]);
      });

    const getWatched: Effect.Effect<Record<string, string[]>> = Effect.sync(() =>
      watcher.getWatched(),
    );

    return { stream, ready, add, unwatch, getWatched };
  });

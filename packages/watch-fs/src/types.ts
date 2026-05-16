import type { ChokidarOptions } from 'chokidar';
import type { Effect, Stream } from 'effect';
import type { WatchEvent, WatchEventName } from './events.js';
import type { WatchError } from './errors.js';

export interface WatchController {
  /** Subscribe to a single event type. Each call independently registers on chokidar. */
  readonly stream: (event: WatchEventName) => Stream.Stream<WatchEvent, WatchError>;
  /** Resolves once chokidar's initial scan is complete and the watcher is ready for changes. */
  readonly ready: Effect.Effect<void>;
  readonly add: (paths: string | ReadonlyArray<string>) => Effect.Effect<void>;
  readonly unwatch: (paths: string | ReadonlyArray<string>) => Effect.Effect<void>;
  /** Returns an object mapping watched directories to the files they contain. */
  readonly getWatched: Effect.Effect<Record<string, string[]>>;
}

export interface WatchOptions extends ChokidarOptions {}

/**
 * @effect-pantry/watch-fs — Effect-native file watching wrapping chokidar.
 *
 * Provides a scoped controller with a stream of file change events,
 * typed errors, and dynamic add/unwatch — all backed by a single
 * chokidar watcher.
 *
 * @module
 */

export { WatchEvent } from './events.js';

export {
  WatchLimitReached,
  WatchPermissionDenied,
  WatchPathNotFound,
  WatchUnknownError,
} from './errors.js';
export type { WatchError } from './errors.js';

export type { WatchController, WatchOptions } from './types.js';

export { watch } from './watch.js';

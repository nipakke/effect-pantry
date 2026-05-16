import { Data } from 'effect';

/**
 * File-system change events that the watcher emits.
 *
 * These map 1:1 to chokidar's event names. Subscribe via
 * `controller.stream(event)` to get a stream scoped to a single event type.
 *
 * | Event | Fires when… |
 * |---|---|
 * | `add` | A file is created |
 * | `change` | A file is modified |
 * | `unlink` | A file is deleted |
 * | `addDir` | A directory is created |
 * | `unlinkDir` | A directory is deleted |
 * | `all` | **Any** of the above — acts as a wildcard |
 *
 * Meta-events like `"ready"` and `"raw"` are excluded.
 * The `"error"` event is handled through the typed error channel.
 */
export type WatchEventName = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir' | 'all';

/**
 * A file change event emitted by the watcher.
 *
 * - `event` — the event name (e.g. `"add"`, `"change"`, `"unlink"`)
 * - `path` — the absolute path of the affected file/directory
 */
export class WatchEvent extends Data.TaggedClass('WatchEvent')<{
  readonly event: WatchEventName;
  readonly path: string;
}> {}

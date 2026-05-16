# @effect-pantry/watch-fs

**Effect-native file watching** — wraps [chokidar](https://github.com/paulmillr/chokidar) as typed [Effect](https://effect.website) streams with `Scope`-based resource management.

```ts
import { watch } from '@effect-pantry/watch-fs';
import { Effect, Stream } from 'effect';
import { NodeRuntime } from '@effect/platform-node';

NodeRuntime.runMain(
  Effect.scoped(
    Effect.gen(function* () {
      const { stream, ready } = yield* watch('src/', { ignoreInitial: true });
      yield* ready;
      yield* stream('change').pipe(
        Stream.runForEach((e) => Effect.sync(() => console.log('changed:', e.path))),
      );
    }),
  ),
);
```

## Installation

```sh
npm install @effect-pantry/watch-fs
```

Requires `effect` and `@effect/platform` as peer dependencies.

## API

### `watch(paths, options?)`

Creates a chokidar watcher inside a `Scope`. Returns a `WatchController`.

```ts
watch(
  paths: string | ReadonlyArray<string>,
  options?: WatchOptions, // extends chokidar.ChokidarOptions
): Effect<WatchController, never, Scope>
```

### `WatchController`

| Member           | Description                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `stream(event)`  | `Stream` of `WatchEvent` for the given event type (`'add'` \| `'change'` \| `'unlink'` \| `'addDir'` \| `'unlinkDir'` \| `'all'`) |
| `ready`          | Resolves once chokidar's initial scan completes                                                                                   |
| `add(paths)`     | Dynamically add paths                                                                                                             |
| `unwatch(paths)` | Dynamically remove paths                                                                                                          |
| `getWatched`     | Returns `Record<string, string[]>` of watched directories                                                                         |

### `WatchEvent`

```ts
class WatchEvent extends Data.TaggedClass('WatchEvent')<{
  readonly event: WatchEventName
  readonly path: string
}>
```

### Errors

chokidar errors are mapped to tagged Effect errors:

| Error                   | System codes       |
| ----------------------- | ------------------ |
| `WatchLimitReached`     | `ENOSPC`, `EMFILE` |
| `WatchPermissionDenied` | `EACCES`, `EPERM`  |
| `WatchPathNotFound`     | `ENOENT`           |
| `WatchUnknownError`     | (other)            |

```ts
stream('add').pipe(Effect.catchTags({
  WatchLimitReached: (e) => ...,
  WatchPermissionDenied: (e) => ...,
  WatchPathNotFound: (e) => ...,
}))
```

## Examples

**Subscribe to a single event:**

```ts
const { stream } = yield * watch('.');
const adds = stream('add'); // only file creations
const changes = stream('change'); // only modifications
const all = stream('all'); // everything
```

**Dynamic paths at runtime:**

```ts
const { add, unwatch } = yield * watch('src/');
yield * add('generated/');
yield * unwatch('src/temp/');
```

**Filter events by type:**

```ts
yield *
  stream('unlink').pipe(
    Stream.runForEach((e) => Effect.sync(() => console.log('deleted:', e.path))),
  );
```

## License

MIT

import { Data } from 'effect';

/**
 * Reached the OS inotify / file-descriptor limit (ENOSPC / EMFILE).
 */
export class WatchLimitReached extends Data.TaggedError('WatchLimitReached')<{
  readonly message: string;
  readonly cause: Error;
}> {}

/**
 * Permission denied accessing a watched path (EACCES / EPERM).
 */
export class WatchPermissionDenied extends Data.TaggedError('WatchPermissionDenied')<{
  readonly message: string;
  readonly cause: Error;
}> {}

/**
 * A watched path no longer exists (ENOENT).
 */
export class WatchPathNotFound extends Data.TaggedError('WatchPathNotFound')<{
  readonly message: string;
  readonly cause: Error;
}> {}

/**
 * An unclassified chokidar error occurred.
 */
export class WatchUnknownError extends Data.TaggedError('WatchUnknownError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export type WatchError =
  | WatchLimitReached
  | WatchPermissionDenied
  | WatchPathNotFound
  | WatchUnknownError;

/** @internal */
export const toWatchError = (error: unknown): WatchError => {
  if (error instanceof Error && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    switch (code) {
      case 'ENOSPC':
      case 'EMFILE':
        return new WatchLimitReached({ message: error.message, cause: error });
      case 'EACCES':
      case 'EPERM':
        return new WatchPermissionDenied({ message: error.message, cause: error });
      case 'ENOENT':
        return new WatchPathNotFound({ message: error.message, cause: error });
    }
  }
  return new WatchUnknownError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
};

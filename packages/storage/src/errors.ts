import { Data } from 'effect';
import * as FilesSDK from 'files-sdk';

/**
 * The requested key, bucket, or container does not exist.
 *
 * @param cause - The original underlying error from the storage provider.
 */
export class StorageNotFoundError extends Data.TaggedError('StorageNotFoundError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * Credentials are missing, expired, or have insufficient permissions.
 *
 * @param cause - The original underlying error from the storage provider.
 */
export class StorageUnauthorizedError extends Data.TaggedError('StorageUnauthorizedError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * A precondition failed (e.g. a conditional write lost a race).
 *
 * @param cause - The original underlying error from the storage provider.
 */
export class StorageConflictError extends Data.TaggedError('StorageConflictError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * A provider-level failure: network, throttling, 5xx, timeout, or cancellation.
 *
 * @param cause - The original underlying error from the storage provider.
 */
export class StorageProviderError extends Data.TaggedError('StorageProviderError')<{
  readonly message: string;
  readonly cause: unknown;
  readonly aborted: boolean;
}> {}

export type StorageError =
  | StorageNotFoundError
  | StorageUnauthorizedError
  | StorageConflictError
  | StorageProviderError;

/**
 * Map an unknown error (ideally an SDK `FilesError`) to a tagged Effect error.
 *
 * Fallback: unknown errors become `StorageProviderError` with `aborted: false`.
 */
export const toStorageError = (error: unknown): StorageError => {
  if (error instanceof FilesSDK.FilesError) {
    const message = error.message;
    const cause = error.cause;
    switch (error.code) {
      case 'NotFound':
        return new StorageNotFoundError({ message, cause });
      case 'Unauthorized':
        return new StorageUnauthorizedError({ message, cause });
      case 'Conflict':
        return new StorageConflictError({ message, cause });
      default:
        // files-sdk v1.6 has exactly four codes ("NotFound", "Unauthorized",
        // "Conflict", "Provider"). If this branch triggers, the SDK added a new
        // error code — file an issue to add a dedicated tagged error.
        return new StorageProviderError({ message, cause, aborted: error.aborted });
    }
  }
  return new StorageProviderError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
    aborted: false,
  });
};

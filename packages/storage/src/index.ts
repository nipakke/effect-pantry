/**
 * @effect-pantry/storage — Effect-native storage wrapping files-sdk.
 *
 * Provides a {@link Storage} context tag backed by any files-sdk adapter
 * (memory, fs, S3, R2, Vercel Blob, and 35+ more), with typed errors and
 * automatic cancellation bridging.
 *
 * New in files-sdk 1.9:
 * - {@link sync} — incremental mirror of two Files instances
 * - {@link StorageInterface.search} — glob/regex key search as an Effect Stream
 * - {@link StorageInterface.capabilities} — query adapter features at runtime
 * - `readonly`, `receipts`, `plugins` passthrough in {@link MakeOptions}
 * - `multipart`, `control` (resumable), `cacheControl` in {@link UploadOptions}
 *
 * **⚠️ Early-stage package** — APIs may change without notice.
 * Not recommended for production use yet.
 *
 * @module
 */

export { Storage, make, layer } from './service.js';
export { StorageAdapter } from './adapter.js';
export type { FileHandle, MakeOptions, UploadOptions } from './service-types.js';
export { transfer } from './features/transfer.js';
export type { TransferOptions } from './features/transfer.js';
export { sync } from './features/sync.js';
export type { SyncOptions } from './features/sync.js';

export {
  StorageNotFoundError,
  StorageUnauthorizedError,
  StorageConflictError,
  StorageReadOnlyError,
  StorageProviderError,
  toStorageError,
} from './errors.js';
export type { StorageError } from './errors.js';

export type { HookEvent, HookEventMap, HookName } from './hooks.js';

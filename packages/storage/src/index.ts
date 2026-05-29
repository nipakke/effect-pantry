/**
 * @effect-pantry/storage — Effect-native storage wrapping files-sdk.
 *
 * Provides a {@link Storage} context tag backed by any files-sdk adapter
 * (memory, fs, S3, R2, Vercel Blob, and 35+ more), with typed errors and
 * automatic cancellation bridging.
 *
 * @module
 */

export * as Storage from "./service.js";
export type { UploadOptions } from "./service-types.js";
export * as StorageAdapter from "./adapter.js";
export { transfer } from "./features/transfer.js";
export type { TransferOptions } from "./features/transfer.js";

export {
  StorageNotFoundError,
  StorageUnauthorizedError,
  StorageConflictError,
  StorageProviderError,
  toStorageError,
} from "./errors.js";
export type { StorageError } from "./errors.js";

export type { HookEvent, HookEventMap, HookName } from "./hooks.js";

import * as FilesSDK from "files-sdk";
import { Context, Effect, Layer } from "effect";
import { StorageAdapter } from "./adapter.js";
import { type StorageError } from "./errors.js";
import { wrapSDKCall } from "./internal.js";

/**
 * Effect-native storage service wrapping a `files-sdk` {@link FilesSDK.Files} instance.
 *
 * Depends on {@link StorageAdapter} from the Effect context to create the underlying
 * SDK client. Every method bridges the SDK's promise-based API to Effect,
 * carrying typed errors via {@link StorageError} and automatically handling
 * cancellation through Effect's interruption model.
 *
 * **Note:** Bulk operations (`uploadAll`, `downloadAll`, etc.) are not yet
 * exposed on this service. Use {@link FilesSDK.Files} directly or combine
 * individual calls with {@link Effect.all} for concurrent operations.
 *
 * Provide via {@link Storage.layer}.
 */
export class Storage extends Context.Tag("@effect-pantry/storage/Storage")<
  Storage,
  {
    readonly upload: (
      /** Object key (path) to store the object at. */
      key: string,
      /** Body content to upload (string, Buffer, ReadableStream, Blob, File, etc.). */
      body: FilesSDK.Body,
      /** Optional upload configuration (contentType, multipart threshold, etc.). */
      opts?: FilesSDK.UploadOptions,
    ) => Effect.Effect<FilesSDK.UploadResult, StorageError>;

    readonly download: (
      /** Object key (path) to retrieve. */
      key: string,
      /** Optional download configuration (range, accept header, stream mode, etc.). */
      opts?: FilesSDK.DownloadOptions,
    ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

    readonly head: (
      /** Object key (path) to inspect without downloading. */
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

    readonly exists: (
      /** Object key (path) to check for existence. */
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<boolean, StorageError>;

    readonly delete: (
      /** Object key (path) to permanently remove. */
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly copy: (
      /** Source key (path) to copy from. */
      from: string,
      /** Destination key (path) to copy to. */
      to: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly move: (
      /** Source key (path) to move from. */
      from: string,
      /** Destination key (path) to move to. */
      to: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly list: (
      /** Optional listing configuration (prefix, maxKeys, cursor, recursive, etc.). */
      opts?: FilesSDK.ListOptions,
    ) => Effect.Effect<FilesSDK.ListResult, StorageError>;

    readonly url: (
      /** Object key (path) to generate a public/download URL for. */
      key: string,
      /** Optional URL configuration (expiresIn, etc.). */
      opts?: FilesSDK.UrlOptions,
    ) => Effect.Effect<string, StorageError>;

    readonly signedUploadUrl: (
      /** Object key (path) to generate a signed upload URL for. */
      key: string,
      /** Required by the underlying SDK — `expiresIn` is always required;
       *  `contentType` and `maxSize` may also be needed depending on the adapter. */
      opts: FilesSDK.SignUploadOptions,
    ) => Effect.Effect<FilesSDK.SignedUpload, StorageError>;
  }
>() { }

/**
 * Create a {@link Storage} service from the adapter found in the Effect context.
 *
 * @example
 * ```ts
 * const svc = yield* Storage.make;
 * ```
 */
export const make = Effect.gen(function* () {
  const adapter = yield* StorageAdapter;
  const files = new FilesSDK.Files({
    adapter,
  });

  return Storage.of({
    upload: (key, body, opts) =>
      wrapSDKCall((signal) => files.upload(key, body, { ...opts, signal })),

    download: (key, opts) =>
      wrapSDKCall((signal) => files.download(key, { ...opts, signal })),

    head: (key, opts) =>
      wrapSDKCall((signal) => files.head(key, { ...opts, signal })),

    exists: (key, opts) =>
      wrapSDKCall((signal) => files.exists(key, { ...opts, signal })),

    delete: (key, opts) =>
      wrapSDKCall((signal) => files.delete(key, { ...opts, signal })),

    copy: (from, to, opts) =>
      wrapSDKCall((signal) => files.copy(from, to, { ...opts, signal })),

    move: (from, to, opts) =>
      wrapSDKCall((signal) => files.move(from, to, { ...opts, signal })),

    list: (opts) =>
      wrapSDKCall((signal) => files.list({ ...opts, signal })),

    url: (key, opts) =>
      wrapSDKCall((signal) => files.url(key, { ...opts, signal })),

    signedUploadUrl: (key, opts) =>
      wrapSDKCall((signal) => files.signedUploadUrl(key, { ...opts, signal })),
  });
});

/**
 * An {@link Effect.Layer} that requires {@link StorageAdapter} and provides
 * {@link Storage}. The consumer supplies the adapter layer.
 *
 * @example
 * ```ts
 * import { memory } from "files-sdk/memory";
 * import { Storage, StorageAdapter } from "@effect-pantry/storage";
 *
 * const layer = Storage.layer.pipe(
 *   Layer.provide(Layer.succeed(StorageAdapter, memory({}))),
 * );
 * ```
 */
export const layer = Layer.effect(Storage, make);

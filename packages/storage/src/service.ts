import * as FilesSDK from "files-sdk";
import { Context, Effect, Layer } from "effect";
import { StorageAdapter } from "./adapter.js";
import { type StorageError } from "./errors.js";
import { wrap } from "./internal.js";

/**
 * Effect-native storage service wrapping a `files-sdk` {@link FilesSDK.Files} instance.
 *
 * Depends on {@link StorageAdapter} from the Effect context to create the underlying
 * SDK client. Every method bridges the SDK's promise-based API to Effect,
 * carrying typed errors via {@link StorageError} and automatically handling
 * cancellation through Effect's interruption model.
 *
 * Provide via {@link Storage.layer}.
 */
export class Storage extends Context.Tag("@effect-pantry/storage/Storage")<
  Storage,
  {
    readonly upload: (
      key: string,
      body: FilesSDK.Body,
      opts?: FilesSDK.UploadOptions,
    ) => Effect.Effect<FilesSDK.UploadResult, StorageError>;

    readonly download: (
      key: string,
      opts?: FilesSDK.DownloadOptions,
    ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

    readonly head: (
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

    readonly exists: (
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<boolean, StorageError>;

    readonly delete: (
      key: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly copy: (
      from: string,
      to: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly move: (
      from: string,
      to: string,
      opts?: FilesSDK.OperationOptions,
    ) => Effect.Effect<void, StorageError>;

    readonly list: (
      opts?: FilesSDK.ListOptions,
    ) => Effect.Effect<FilesSDK.ListResult, StorageError>;

    readonly url: (
      key: string,
      opts?: FilesSDK.UrlOptions,
    ) => Effect.Effect<string, StorageError>;

    readonly signedUploadUrl: (
      key: string,
      opts: FilesSDK.SignUploadOptions,
    ) => Effect.Effect<FilesSDK.SignedUpload, StorageError>;
  }
>() {}

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
  const files = new FilesSDK.Files({ adapter });

  return Storage.of({
    upload: (key, body, opts) =>
      wrap((signal) => files.upload(key, body, { ...opts, signal })),

    download: (key, opts) =>
      wrap((signal) => files.download(key, { ...opts, signal })),

    head: (key, opts) =>
      wrap((signal) => files.head(key, { ...opts, signal })),

    exists: (key, opts) =>
      wrap((signal) => files.exists(key, { ...opts, signal })),

    delete: (key, opts) =>
      wrap((signal) => files.delete(key, { ...opts, signal })),

    copy: (from, to, opts) =>
      wrap((signal) => files.copy(from, to, { ...opts, signal })),

    move: (from, to, opts) =>
      wrap((signal) => files.move(from, to, { ...opts, signal })),

    list: (opts) =>
      wrap((signal) => files.list({ ...opts, signal })),

    url: (key, opts) =>
      wrap((signal) => files.url(key, { ...opts, signal })),

    signedUploadUrl: (key, opts) =>
      wrap((signal) => files.signedUploadUrl(key, { ...opts, signal })),
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

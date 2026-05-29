import * as FilesSDK from 'files-sdk';
import { Effect, Stream } from 'effect';
import type { StorageError } from './errors.js';
import type { HookEventMap, HookName } from './hooks.js';

/** Options for {@link Storage.upload}, with `signal` and `onProgress` managed internally. */
export type UploadOptions = Omit<FilesSDK.UploadOptions, 'signal' | 'onProgress'>;

/**
 * A key-bound handle to a single storage object.
 *
 * Returned by {@link StorageInterface.file} — every method operates on the
 * pre-bound key so callers don't need to pass it on each call. Key
 * validation happens eagerly at construction; all I/O defers to the
 * underlying {@link StorageInterface} methods.
 *
 * @example
 * ```ts
 * const avatar = svc.file("avatars/abc.png");
 * yield* avatar.upload(body, { contentType: "image/png" });
 * if (yield* avatar.exists()) {
 *   const meta = yield* avatar.head();
 * }
 * ```
 */
export interface FileHandle {
  /** The key this handle is bound to. */
  readonly key: string;

  readonly upload: (
    body: FilesSDK.Body,
    opts?: UploadOptions,
  ) => Effect.Effect<
    {
      result: Effect.Effect<FilesSDK.UploadResult, StorageError>;
      progress: Stream.Stream<FilesSDK.UploadProgress>;
    },
    never
  >;

  readonly download: (
    opts?: FilesSDK.DownloadOptions,
  ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

  readonly head: (
    opts?: FilesSDK.OperationOptions,
  ) => Effect.Effect<FilesSDK.StoredFile, StorageError>;

  readonly exists: (opts?: FilesSDK.OperationOptions) => Effect.Effect<boolean, StorageError>;

  readonly delete: (opts?: FilesSDK.OperationOptions) => Effect.Effect<void, StorageError>;

  readonly url: (opts?: FilesSDK.UrlOptions) => Effect.Effect<string, StorageError>;

  readonly signedUploadUrl: (
    opts: FilesSDK.SignUploadOptions,
  ) => Effect.Effect<FilesSDK.SignedUpload, StorageError>;

  /**
   * Copy the handle's object to a new key. The handle is the source.
   * Shortcut for `Storage.copy(handle.key, destKey, opts)`.
   */
  readonly copyTo: (
    destKey: string,
    opts?: FilesSDK.OperationOptions,
  ) => Effect.Effect<void, StorageError>;

  /**
   * Copy from a source key into the handle's key. The handle is the destination.
   * Shortcut for `Storage.copy(srcKey, handle.key, opts)`.
   */
  readonly copyFrom: (
    srcKey: string,
    opts?: FilesSDK.OperationOptions,
  ) => Effect.Effect<void, StorageError>;
}

/**
 * Options passed to {@link Storage.make} to configure the underlying
 * {@link FilesSDK.Files} instance.
 *
 * `adapter` and `hooks` are excluded — the adapter comes from the
 * {@link StorageAdapter} context tag and hooks are wired internally to
 * the PubSub event stream.
 */
export type MakeOptions = Omit<FilesSDK.FilesOptions<FilesSDK.Adapter>, 'adapter' | 'hooks'>;

/**
 * Type interface for the Storage service — separated from the
 * implementation to keep each file focused and under the module-size
 * guideline.
 *
 * The runtime {@link Context.Tag} lives in `service.ts` alongside
 * {@link make} and {@link layer}.
 */
export interface StorageInterface {
  readonly upload: (
    /** Object key (path) to store the object at. */
    key: string,
    /** Body content to upload (string, Buffer, ReadableStream, Blob, File, etc.). */
    body: FilesSDK.Body,
    /** Optional upload configuration (contentType, multipart threshold, etc.). */
    opts?: UploadOptions,
  ) => Effect.Effect<
    {
      result: Effect.Effect<FilesSDK.UploadResult, StorageError>;
      progress: Stream.Stream<FilesSDK.UploadProgress>;
    },
    never
  >;

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

  /**
   * Create a {@link FileHandle} bound to a single key.
   *
   * The key is validated eagerly — an empty key throws synchronously.
   * Every method on the handle delegates to the corresponding
   * {@link StorageInterface} method, so adapters implement nothing extra.
   *
   * @example
   * ```ts
   * const avatar = svc.file("avatars/abc.png");
   * yield* avatar.upload(body, { contentType: "image/png" });
   * yield* avatar.copyTo("avatars/abc.bak.png");
   * ```
   */
  readonly file: (key: string) => FileHandle;

  /**
   * Subscribe to constructor hook events as an Effect {@link Stream}.
   *
   * Events are emitted from an unbounded internal {@link PubSub} — every
   * storage operation pushes into it, and the stream filters to the chosen
   * hook kind. Multiple consumers can subscribe independently; each gets
   * its own subscription.
   *
   * The stream ends when the storage layer's scope is released.
   *
   * **Note:** The internal PubSub is unbounded. If consumers never drain
   * the stream, memory grows without limit. Always run the stream consumer
   * or cancel it before producing a large volume of events.
   *
   * @example
   * ```ts
   * const svc = yield* Storage;
   *
   * // Stream of FilesActionEvent
   * yield* svc.hookStream("onAction").pipe(
   *   Stream.runForEach((e) => Effect.log(`Storage ${e.type}: ${e.status}`)),
   *   Effect.forkScoped,
   * );
   * ```
   */
  readonly hookStream: <N extends HookName>(name: N) => Stream.Stream<HookEventMap[N], never>;
}

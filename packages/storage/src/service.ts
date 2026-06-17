import * as FilesSDK from 'files-sdk';
import { Context, Effect, Layer, pipe, PubSub, Stream } from 'effect';
import { StorageAdapter } from './adapter.js';
import type { HookEvent, HookEventMap, HookName } from './hooks.js';
import { bridgeProgress, wrapSDKCall } from './internal.js';
import { toStorageError } from './errors.js';
import type { FileHandle, MakeOptions, StorageInterface } from './service-types.js';

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
export class Storage extends Context.Tag('@effect-pantry/storage/Storage')<
  Storage,
  StorageInterface
>() {}

/**
 * Create a {@link Storage} service from the adapter found in the Effect context.
 *
 * Accepts optional {@link MakeOptions} to configure the underlying
 * {@link FilesSDK.Files} instance (e.g. `prefix`, `timeout`, `retries`,
 * `readonly`, `receipts`, `plugins`).
 * The `adapter` and `hooks` options are managed internally and cannot be
 * overridden.
 *
 * @example
 * ```ts
 * const svc = yield* Storage.make();
 * ```
 *
 * @example With options
 * ```ts
 * const svc = yield* Storage.make({ prefix: "uploads/", timeout: 30_000 });
 * ```
 *
 * @example Read-only mode (files-sdk 1.8+)
 * ```ts
 * const svc = yield* Storage.make({ readonly: true });
 * // upload, delete, copy, move will fail with ReadOnly error
 * ```
 */
export const make = (options?: MakeOptions) =>
  Effect.gen(function* () {
    yield* Effect.logWarning(
      '@effect-pantry/storage is in early development — APIs may change. Not recommended for production yet.',
    );

    const adapter = yield* StorageAdapter;
    const pubsub = yield* PubSub.unbounded<HookEvent>();

    const offer = (event: HookEvent): void => {
      const ok = pubsub.unsafeOffer(event);
      if (!ok) {
        console.warn('[Storage] hook event dropped: PubSub not accepting');
      }
    };

    const files = new FilesSDK.Files({
      ...options,
      adapter,
      hooks: {
        onAction: (event) => offer({ _tag: 'onAction' as const, event }),
        onError: (event) => offer({ _tag: 'onError' as const, event }),
        onRetry: (event) => offer({ _tag: 'onRetry' as const, event }),
      },
    });

    const svc: StorageInterface = {
      upload: (key, body, opts) =>
        bridgeProgress<FilesSDK.UploadResult, FilesSDK.UploadProgress>((signal, onProgress) =>
          files.upload(key, body, { ...opts, signal, onProgress }),
        ),

      download: (key, opts) => wrapSDKCall((signal) => files.download(key, { ...opts, signal })),

      head: (key, opts) => wrapSDKCall((signal) => files.head(key, { ...opts, signal })),

      exists: (key, opts) => wrapSDKCall((signal) => files.exists(key, { ...opts, signal })),

      delete: (key, opts) => wrapSDKCall((signal) => files.delete(key, { ...opts, signal })),

      copy: (from, to, opts) => wrapSDKCall((signal) => files.copy(from, to, { ...opts, signal })),

      move: (from, to, opts) => wrapSDKCall((signal) => files.move(from, to, { ...opts, signal })),

      list: (opts) => wrapSDKCall((signal) => files.list({ ...opts, signal })),

      search: (pattern, opts) =>
        Stream.fromAsyncIterable(files.search(pattern, opts), toStorageError),

      get capabilities() {
        return files.capabilities;
      },

      url: (key, opts) => wrapSDKCall((signal) => files.url(key, { ...opts, signal })),

      signedUploadUrl: (key, opts) =>
        wrapSDKCall((signal) => files.signedUploadUrl(key, { ...opts, signal })),

      hookStream: <N extends HookName>(name: N): Stream.Stream<HookEventMap[N], never> =>
        pipe(
          Stream.fromPubSub(pubsub),
          Stream.filter((e) => e._tag === name),
          Stream.map((e) => e.event),
        ) as Stream.Stream<HookEventMap[N], never>,

      file: (key): FileHandle => ({
        key,
        upload: (body, opts) => svc.upload(key, body, opts),
        download: (opts) => svc.download(key, opts),
        head: (opts) => svc.head(key, opts),
        exists: (opts) => svc.exists(key, opts),
        delete: (opts) => svc.delete(key, opts),
        url: (opts) => svc.url(key, opts),
        signedUploadUrl: (opts) => svc.signedUploadUrl(key, opts),
        copyTo: (destKey, opts) => svc.copy(key, destKey, opts),
        copyFrom: (srcKey, opts) => svc.copy(srcKey, key, opts),
      }),
    };

    return Storage.of(svc);
  });

/**
 * Create an {@link Effect.Layer} that requires {@link StorageAdapter} and provides
 * {@link Storage}. The consumer supplies the adapter layer.
 *
 * Accepts optional {@link MakeOptions} forwarded to
 * {@link make}.
 *
 * @example
 * ```ts
 * import { memory } from "files-sdk/memory";
 * import { Storage, StorageAdapter } from "@effect-pantry/storage";
 *
 * const layer = Storage.layer().pipe(
 *   Layer.provide(Layer.succeed(StorageAdapter, memory())),
 * );
 * ```
 *
 * @example With options
 * ```ts
 * const layer = Storage.layer({ prefix: "app-data/" }).pipe(
 *   Layer.provide(Layer.succeed(StorageAdapter, memory())),
 * );
 * ```
 */
export const layer = (options?: MakeOptions) => Layer.effect(Storage, make(options));

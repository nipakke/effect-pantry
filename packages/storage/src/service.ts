import * as FilesSDK from "files-sdk";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import { StorageAdapter } from "./adapter.js";
import type { HookEvent, HookEventMap, HookName } from "./hooks.js";
import { bridgeProgress, validateKey, wrapSDKCall } from "./internal.js";
import type { StorageInterface } from "./service-types.js";

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
  StorageInterface
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
  const pubsub = yield* PubSub.unbounded<HookEvent>();

  const offer = (event: HookEvent): void => {
    const ok = pubsub.unsafeOffer(event);
    if (!ok && process.env.NODE_ENV === "development") {
      console.warn("[Storage] hook event dropped: PubSub not accepting");
    }
  };

  const files = new FilesSDK.Files({
    adapter,
    hooks: {
      onAction: (event) => offer({ _tag: "onAction" as const, event }),
      onError: (event) => offer({ _tag: "onError" as const, event }),
      onRetry: (event) => offer({ _tag: "onRetry" as const, event }),
    },
  });

  return Storage.of({
    upload: (key, body, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* bridgeProgress<FilesSDK.UploadResult, FilesSDK.UploadProgress>(
          (signal, onProgress) =>
            files.upload(key, body, { ...opts, signal, onProgress }),
        );
      }),

    download: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.download(key, { ...opts, signal }));
      }),

    head: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.head(key, { ...opts, signal }));
      }),

    exists: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.exists(key, { ...opts, signal }));
      }),

    delete: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.delete(key, { ...opts, signal }));
      }),

    copy: (from, to, opts) =>
      Effect.gen(function* () {
        yield* validateKey(from, "from");
        yield* validateKey(to, "to");
        return yield* wrapSDKCall((signal) => files.copy(from, to, { ...opts, signal }));
      }),

    move: (from, to, opts) =>
      Effect.gen(function* () {
        yield* validateKey(from, "from");
        yield* validateKey(to, "to");
        return yield* wrapSDKCall((signal) => files.move(from, to, { ...opts, signal }));
      }),

    list: (opts) =>
      wrapSDKCall((signal) => files.list({ ...opts, signal })),

    url: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.url(key, { ...opts, signal }));
      }),

    signedUploadUrl: (key, opts) =>
      Effect.gen(function* () {
        yield* validateKey(key, "key");
        return yield* wrapSDKCall((signal) => files.signedUploadUrl(key, { ...opts, signal }));
      }),

    hookStream: <N extends HookName>(name: N): Stream.Stream<HookEventMap[N], never> =>
      Stream.fromPubSub(pubsub).pipe(
        Stream.filter((e) => e._tag === name),
        Stream.map((e) => e.event),
      ) as Stream.Stream<HookEventMap[N], never>,
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
 *   Layer.provide(Layer.succeed(StorageAdapter, memory())),
 * );
 * ```
 */
export const layer = Layer.effect(Storage, make);

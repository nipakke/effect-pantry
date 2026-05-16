import { Context, Effect, Runtime } from 'effect';
import { BentoCacheError } from './errors.js';
import type { IBentoCacheService, EffectGetOrSetOptions } from './types.js';

export const BentoCacheService = Context.GenericTag<IBentoCacheService>(
  '@effect-pantry/bentocache/BentoCacheService',
);

interface BentoProvider {
  get<T = any>(options: { key: string; defaultValue?: any }): Promise<T>;
  set(options: { key: string; value: any; ttl?: any }): Promise<boolean>;
  setForever(options: { key: string; value: any }): Promise<boolean>;
  getOrSet<T = any>(options: {
    key: string;
    factory: () => T | Promise<T>;
    ttl?: any;
    grace?: any;
    graceBackoff?: any;
    timeout?: any;
    hardTimeout?: any;
    forceFresh?: boolean;
    tags?: string[];
  }): Promise<T>;
  has(options: { key: string }): Promise<boolean>;
  missing(options: { key: string }): Promise<boolean>;
  pull<T = any>(key: string): Promise<T | null | undefined>;
  delete(options: { key: string }): Promise<boolean>;
  deleteMany(options: { keys: string[] }): Promise<boolean>;
  clear(): Promise<void>;
  namespace(name: string): BentoProvider;
}

const toGetOrSetOptions = <A>(
  opts: EffectGetOrSetOptions<any, any, any>,
  factory: () => Promise<A>,
) => ({
  key: opts.key,
  factory,
  ...(opts.ttl !== undefined ? { ttl: opts.ttl } : {}),
  ...(opts.grace !== undefined ? { grace: opts.grace } : {}),
  ...(opts.graceBackoff !== undefined ? { graceBackoff: opts.graceBackoff } : {}),
  ...(opts.timeout !== undefined ? { timeout: opts.timeout } : {}),
  ...(opts.hardTimeout !== undefined ? { hardTimeout: opts.hardTimeout } : {}),
  ...(opts.forceFresh !== undefined ? { forceFresh: opts.forceFresh } : {}),
  ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
});

export const makeBentoCacheService = (bento: BentoProvider): IBentoCacheService => ({
  getOrSet<A, E, R>(opts: EffectGetOrSetOptions<A, E, R>) {
    return Effect.gen(function* () {
      const rt = yield* Effect.runtime<R>();
      const factory = (): Promise<A> => Runtime.runPromise(rt)(opts.effect);
      return yield* Effect.tryPromise({
        try: () => bento.getOrSet(toGetOrSetOptions(opts, factory)),
        catch: (cause) =>
          new BentoCacheError({
            cause,
            message: String(cause),
            key: opts.key,
          }),
      });
    });
  },

  get<A>(key: string) {
    return Effect.tryPromise({
      try: () => bento.get<A>({ key }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    });
  },

  getWithDefault<A>(key: string, defaultValue: A) {
    return Effect.tryPromise({
      try: () => bento.get<A>({ key, defaultValue }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    });
  },

  set<A>(key: string, value: A, ttl?: string | number | null) {
    return Effect.tryPromise({
      try: () =>
        bento.set({
          key,
          value,
          ...(ttl !== undefined && ttl !== null ? { ttl } : {}),
        }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    }).pipe(Effect.as(undefined));
  },

  setForever<A>(key: string, value: A) {
    return Effect.tryPromise({
      try: () => bento.setForever({ key, value }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    }).pipe(Effect.as(undefined));
  },

  has(key: string) {
    return Effect.tryPromise({
      try: () => bento.has({ key }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    });
  },

  missing(key: string) {
    return Effect.tryPromise({
      try: () => bento.missing({ key }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    });
  },

  pull<A>(key: string) {
    return Effect.tryPromise({
      try: () => bento.pull<A>(key),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    });
  },

  delete(key: string) {
    return Effect.tryPromise({
      try: () => bento.delete({ key }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause), key }),
    }).pipe(Effect.as(undefined));
  },

  deleteMany(keys: string[]) {
    return Effect.tryPromise({
      try: () => bento.deleteMany({ keys }),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause) }),
    }).pipe(Effect.as(undefined));
  },

  clear() {
    return Effect.tryPromise({
      try: () => bento.clear(),
      catch: (cause) => new BentoCacheError({ cause, message: String(cause) }),
    });
  },

  namespace(name: string) {
    return makeBentoCacheService(bento.namespace(name));
  },
});

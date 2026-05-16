import type { Effect } from 'effect';
import type { BentoCacheError } from './errors.js';

export type Duration = string | number | null;

export interface EffectGetOrSetOptions<A, E, R> {
  readonly key: string;
  readonly effect: Effect.Effect<A, E, R>;
  readonly ttl?: Duration | undefined;
  readonly grace?: false | Duration | undefined;
  readonly graceBackoff?: Duration | undefined;
  readonly timeout?: Duration | undefined;
  readonly hardTimeout?: Duration | undefined;
  readonly forceFresh?: boolean | undefined;
  readonly tags?: string[] | undefined;
}

export interface IBentoCacheService {
  readonly getOrSet: <A, E, R>(
    opts: EffectGetOrSetOptions<A, E, R>,
  ) => Effect.Effect<A, E | BentoCacheError, R>;

  readonly get: <A>(key: string) => Effect.Effect<A | undefined, BentoCacheError>;

  readonly getWithDefault: <A>(key: string, defaultValue: A) => Effect.Effect<A, BentoCacheError>;

  readonly set: <A>(key: string, value: A, ttl?: Duration) => Effect.Effect<void, BentoCacheError>;

  readonly setForever: <A>(key: string, value: A) => Effect.Effect<void, BentoCacheError>;

  readonly has: (key: string) => Effect.Effect<boolean, BentoCacheError>;

  readonly missing: (key: string) => Effect.Effect<boolean, BentoCacheError>;

  readonly pull: <A>(key: string) => Effect.Effect<A | null | undefined, BentoCacheError>;

  readonly delete: (key: string) => Effect.Effect<void, BentoCacheError>;

  readonly deleteMany: (keys: string[]) => Effect.Effect<void, BentoCacheError>;

  readonly clear: () => Effect.Effect<void, BentoCacheError>;

  readonly namespace: (name: string) => IBentoCacheService;
}

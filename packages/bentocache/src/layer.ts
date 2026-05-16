import { BentoCache } from 'bentocache';
import type { BentoStore } from 'bentocache';
import { Effect, Layer } from 'effect';
import { BentoCacheService, makeBentoCacheService } from './service.js';

export type BentoCacheOptions<K extends Record<string, BentoStore>> = ConstructorParameters<
  typeof BentoCache<Record<string, BentoStore>>
>[0] & {
  default: keyof K;
  stores: K;
};

export const makeBentoCacheLayer = <K extends Record<string, BentoStore>>(
  options: BentoCacheOptions<K>,
) =>
  Layer.scoped(
    BentoCacheService,
    Effect.gen(function* () {
      const bento = yield* Effect.acquireRelease(
        Effect.sync(() => new BentoCache(options)),
        (bento) => Effect.promise(() => bento.disconnect()),
      );
      return makeBentoCacheService(bento);
    }),
  );

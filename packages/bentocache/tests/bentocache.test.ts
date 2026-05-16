import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { bentostore } from 'bentocache';
import { memoryDriver } from 'bentocache/drivers/memory';
import { makeBentoCacheLayer, BentoCacheService } from '../src/index.js';

const makeLayer = makeBentoCacheLayer({
  default: 'test',
  stores: {
    test: bentostore().useL1Layer(memoryDriver({ maxSize: '10mb' })),
  },
});

describe('BentoCacheService', () => {
  it('getOrSet caches factory results', () =>
    Effect.gen(function* () {
      let calls = 0;
      const cache = yield* BentoCacheService;

      const result1 = yield* cache.getOrSet({
        key: 'key1',
        effect: Effect.sync(() => {
          calls++;
          return 'value1';
        }),
        ttl: '10m',
      });
      expect(result1).toBe('value1');
      expect(calls).toBe(1);

      const result2 = yield* cache.getOrSet({
        key: 'key1',
        effect: Effect.sync(() => {
          calls++;
          return 'value2';
        }),
        ttl: '10m',
      });
      expect(result2).toBe('value1'); // cached
      expect(calls).toBe(1); // factory not called again
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('set and get work together', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;

      yield* cache.set('greeting', 'hello', '10m');
      const value = yield* cache.get<string>('greeting');
      expect(value).toBe('hello');
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('has and missing reflect cache state', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;

      const missingBefore = yield* cache.missing('nonexistent');
      expect(missingBefore).toBe(true);

      yield* cache.set('exists', 'yes', '10m');

      const hasAfter = yield* cache.has('exists');
      expect(hasAfter).toBe(true);

      const missingAfter = yield* cache.missing('exists');
      expect(missingAfter).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('deletes keys', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;

      yield* cache.set('temp', 'delete-me', '10m');
      expect(yield* cache.has('temp')).toBe(true);

      yield* cache.delete('temp');
      expect(yield* cache.has('temp')).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('getOrSet propagates factory errors', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;

      const result = yield* Effect.either(
        cache.getOrSet({
          key: 'will-fail',
          effect: Effect.fail('factory-error'),
        }),
      );

      expect(result._tag).toBe('Left');
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('namespace isolates keys', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;
      const users = cache.namespace('users');

      yield* users.set('1', 'Alice', '10m');
      yield* cache.set('1', 'RootAlice', '10m');

      const userValue = yield* users.get<string>('1');
      const rootValue = yield* cache.get<string>('1');

      expect(userValue).toBe('Alice');
      expect(rootValue).toBe('RootAlice');

      yield* users.clear();

      expect(yield* users.has('1')).toBe(false);
      expect(yield* cache.has('1')).toBe(true);
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));

  it('clear removes all keys', () =>
    Effect.gen(function* () {
      const cache = yield* BentoCacheService;

      yield* cache.set('a', 1, '10m');
      yield* cache.set('b', 2, '10m');

      expect(yield* cache.has('a')).toBe(true);
      expect(yield* cache.has('b')).toBe(true);

      yield* cache.clear();

      expect(yield* cache.has('a')).toBe(false);
      expect(yield* cache.has('b')).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(makeLayer), Effect.runPromise));
});

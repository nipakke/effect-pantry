import { it, expect } from '@effect/vitest';
import { Effect, Stream, Schema, Option, Either, Fiber, TestClock, pipe } from 'effect';
import * as Event from '../src/Event.js';
import * as EventBus from '../src/EventBus.js';
import * as Errors from '../src/Errors.js';

// ── Event definitions ─────────────────────────────────────────────────

const StringEvent = Event.make({
  tag: 'test.string',
  payload: Schema.String,
});

const NumberEvent = Event.make({
  tag: 'test.number',
  payload: Schema.Number,
});

// ── Layer ─────────────────────────────────────────────────────────────

const TestLayer = EventBus.layer({ capacity: 16 });

// ── Helpers ───────────────────────────────────────────────────────────

const takeOne = <A>(stream: Stream.Stream<A, any, any>) =>
  pipe(
    stream,
    Stream.take(1),
    Stream.runCollect,
    Effect.map((chunk) => Array.from(chunk)[0]),
  );

// ═════════════════════════════════════════════════════════════════════
// EventBus tests (with layer, using it.scoped inside it.layer)
// ═════════════════════════════════════════════════════════════════════

it.layer(TestLayer)('EventBus', (it) => {
  it.scoped('publishing an event returns true', () =>
    Effect.gen(function* () {
      const result = yield* EventBus.publish(StringEvent, 'hello');
      expect(result).toBe(true);
    }),
  );

  it.scoped('subscriber receives the published event with correct payload', () =>
    Effect.gen(function* () {
      const stream = EventBus.subscribe(StringEvent);
      const fiber = yield* Effect.fork(takeOne(stream));
      yield* TestClock.adjust('10000 millis');
      yield* EventBus.publish(StringEvent, 'hello world');
      const envelope = yield* Fiber.join(fiber);
      expect(envelope?.payload).toBe('hello world');
    }),
  );

  it.scoped(
    'subscriber receives the event wrapped in an Envelope with id, ts, event, payload fields',
    () =>
      Effect.gen(function* () {
        const stream = EventBus.subscribe(StringEvent);
        const fiber = yield* Effect.fork(takeOne(stream));
        yield* TestClock.adjust('10000 millis');
        yield* EventBus.publish(StringEvent, 'envelope test');
        const envelope = yield* Fiber.join(fiber);
        expect(envelope).toBeDefined();
        expect(envelope?.id).toBeDefined();
        expect(typeof envelope?.id).toBe('string');
        expect(envelope?.ts).toBeDefined();
        expect(typeof envelope?.ts).toBe('number');
        expect(envelope?.event).toBeDefined();
        expect(envelope?.event.tag).toBe('test.string');
        expect(envelope?.payload).toBe('envelope test');
      }),
  );

  it.scoped('multiple subscribers both receive the same published event', () =>
    Effect.gen(function* () {
      const stream1 = EventBus.subscribe(StringEvent);
      const stream2 = EventBus.subscribe(StringEvent);
      const fiber1 = yield* Effect.fork(takeOne(stream1));
      const fiber2 = yield* Effect.fork(takeOne(stream2));
      yield* TestClock.adjust('10000 millis');
      yield* EventBus.publish(StringEvent, 'broadcast');
      const env1 = yield* Fiber.join(fiber1);
      const env2 = yield* Fiber.join(fiber2);
      expect(env1?.payload).toBe('broadcast');
      expect(env2?.payload).toBe('broadcast');
    }),
  );

  it.scoped(
    'subscriber filters by event tag (publishing different event type does not trigger subscriber)',
    () =>
      Effect.gen(function* () {
        const stream = EventBus.subscribe(StringEvent);
        const fiber = yield* Effect.fork(takeOne(stream));
        yield* TestClock.adjust('10000 millis');
        yield* EventBus.publish(NumberEvent, 99);
        yield* EventBus.publish(StringEvent, 'only string');
        const envelope = yield* Fiber.join(fiber);
        expect(envelope?.payload).toBe('only string');
        expect(envelope?.event.tag).toBe('test.string');
      }),
  );

  it.scoped('publishOptional returns some(true) when EventBus is provided', () =>
    Effect.gen(function* () {
      const result = yield* EventBus.publishOptional(StringEvent, 'hello');
      expect(Option.isSome(result)).toBe(true);
      if (Option.isSome(result)) {
        expect(result.value).toBe(true);
      }
    }),
  );

  it.scoped('subscribeOptional returns some(stream) and receives events', () =>
    Effect.gen(function* () {
      const opt = yield* EventBus.subscribeOptional(StringEvent);
      expect(Option.isSome(opt)).toBe(true);
      if (!Option.isSome(opt)) return;
      const fiber = yield* Effect.fork(takeOne(opt.value));
      yield* TestClock.adjust('10000 millis');
      yield* EventBus.publish(StringEvent, 'via optional');
      const envelope = yield* Fiber.join(fiber);
      expect(envelope?.payload).toBe('via optional');
    }),
  );

  it.scoped('publishing with bounded capacity works correctly', () =>
    Effect.gen(function* () {
      // TestLayer uses a bounded PubSub with capacity 16;
      // verify that publishing on a bounded bus succeeds.
      const result = yield* EventBus.publish(StringEvent, 'bounded test');
      expect(result).toBe(true);
    }),
  );
});

// ═════════════════════════════════════════════════════════════════════
// Error handling tests (using it.effect, no layer provided)
// ═════════════════════════════════════════════════════════════════════

it.effect('publish without EventBus fails with EventBusNotFoundError', () =>
  Effect.gen(function* () {
    const result = yield* Effect.either(EventBus.publish(StringEvent, 'fail'));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Errors.EventBusNotFoundError);
    }
  }),
);

it.effect('subscribe without EventBus fails with EventBusNotFoundError', () =>
  Effect.gen(function* () {
    const result = yield* pipe(EventBus.subscribe(StringEvent), Stream.runCollect, Effect.either);
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Errors.EventBusNotFoundError);
    }
  }),
);

it.effect('publishOptional returns none when EventBus is not provided', () =>
  Effect.gen(function* () {
    const result = yield* EventBus.publishOptional(StringEvent, 'nope');
    expect(Option.isNone(result)).toBe(true);
  }),
);

it.effect('subscribeOptional returns none when EventBus is not provided', () =>
  Effect.gen(function* () {
    const opt = yield* EventBus.subscribeOptional(StringEvent);
    expect(Option.isNone(opt)).toBe(true);
  }),
);

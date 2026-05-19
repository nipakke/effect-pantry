import { it, expect } from '@effect/vitest';
import { Effect, Stream, Schema, Option, Fiber, TestClock, pipe } from 'effect';
import { Event, EventBus, EventBusNotFoundError } from '../src/index.js';

// ── Event definitions ─────────────────────────────────────────────────

const StringEvent = Event.make({
  tag: 'test.string',
  payload: Schema.String,
});

const NumberEvent = Event.make({
  tag: 'test.number',
  payload: Schema.Number,
});

const VoidEvent = Event.make({ tag: 'test.void' });

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

// ── Event tests (no layer needed) ─────────────────────────────────────

it('Event.make creates a tagged event definition', () => {
  expect(StringEvent.tag).toBe('test.string');
  expect(StringEvent.payload).toBe(Schema.String);
});

it('Event.make defaults payload to Schema.Void', () => {
  expect(VoidEvent.payload).toBe(Schema.Void);
});

// ── EventBus tests with layer ─────────────────────────────────────────

it.layer(TestLayer)('EventBus', (it) => {
  it.scoped('publish returns true and subscriber receives the event', () =>
    Effect.gen(function* () {
      const stream = EventBus.subscribe(StringEvent);

      const fiber = yield* Effect.fork(takeOne(stream));
      // Advance the TestClock to let the runtime process the forked fiber
      // and establish the PubSub subscription before we publish.
      yield* TestClock.adjust("10000 millis");
      yield* EventBus.publish(StringEvent, 'hello world');

      const envelope = yield* Fiber.join(fiber);
      expect(envelope?.payload).toBe('hello world');
    }),
  );

  it.scoped('subscriber filters by tag', () =>
    Effect.gen(function* () {
      const stream = EventBus.subscribe(StringEvent);

      const fiber = yield* Effect.fork(takeOne(stream));
      yield* TestClock.adjust("0 millis");
      yield* EventBus.publish(NumberEvent, 99);
      yield* EventBus.publish(StringEvent, 'only string');

      const envelope = yield* Fiber.join(fiber);
      expect(envelope?.payload).toBe('only string');
      expect(envelope?.event.tag).toBe('test.string');
    }),
  );

  it.scoped('multiple subscribers receive the same event', () =>
    Effect.gen(function* () {
      const stream1 = EventBus.subscribe(StringEvent);
      const stream2 = EventBus.subscribe(StringEvent);

      const fiber1 = yield* Effect.fork(takeOne(stream1));
      const fiber2 = yield* Effect.fork(takeOne(stream2));
      yield* TestClock.adjust("0 millis");

      yield* EventBus.publish(StringEvent, 'broadcast');

      const env1 = yield* Fiber.join(fiber1);
      const env2 = yield* Fiber.join(fiber2);
      expect(env1?.payload).toBe('broadcast');
      expect(env2?.payload).toBe('broadcast');
    }),
  );

  it.scoped('publishOptional returns some(true) when layer is provided', () =>
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
      yield* TestClock.adjust("0 millis");
      yield* EventBus.publish(StringEvent, 'via optional');

      const envelope = yield* Fiber.join(fiber);
      expect(envelope?.payload).toBe('via optional');
    }),
  );

  it.scoped('publish succeeds', () =>
    Effect.gen(function* () {
      const result = yield* Effect.either(EventBus.publish(StringEvent, 'valid'));
      expect(result._tag).toBe('Right');
    }),
  );
});

// ── Error handling without layer ──────────────────────────────────────

it.scoped('publish without EventBus fails with EventBusNotFoundError', () =>
  Effect.gen(function* () {
    const result = yield* Effect.either(EventBus.publish(StringEvent, 'fail'));
    expect(result._tag).toBe('Left');
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(EventBusNotFoundError);
    }
  }),
);

it.scoped('subscribe without EventBus fails with EventBusNotFoundError', () =>
  Effect.gen(function* () {
    const result = yield* pipe(EventBus.subscribe(StringEvent), Stream.runCollect, Effect.either);
    expect(result._tag).toBe('Left');
  }),
);

it.scoped('subscribeOptional returns none when EventBus is not provided', () =>
  Effect.gen(function* () {
    const opt = yield* EventBus.subscribeOptional(StringEvent);
    expect(Option.isNone(opt)).toBe(true);
  }),
);

it.scoped('publishOptional returns none when EventBus is not provided', () =>
  Effect.gen(function* () {
    const result = yield* EventBus.publishOptional(StringEvent, 'nope');
    expect(Option.isNone(result)).toBe(true);
  }),
);

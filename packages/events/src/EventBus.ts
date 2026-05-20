import { Effect, Context, PubSub, Stream, pipe, Layer, Option } from 'effect';
import { EventBusNotFoundError } from './Errors.js';
import { AnyEvent } from './Event.js';
import { InferPayloadTypeId } from './Payload.js';
import * as EnvelopeApi from './Envelope.js';

/**
 * In-memory typed event bus backed by Effect's {@link PubSub}.
 *
 * Provides publish/subscribe with per-event-tag filtering and both
 * fail-fast and optional access patterns.
 *
 * Provide it via {@link EventBus.layer} or manually.
 */
export class EventBus extends Context.Tag('@effect-pantry/events/EventBus')<
  EventBus,
  {
    readonly publish: <TEvent extends AnyEvent>(
      event: TEvent,
      payload: TEvent[typeof InferPayloadTypeId],
    ) => Effect.Effect<boolean>;

    readonly subscribe: <TEvent extends AnyEvent>(
      event: TEvent,
    ) => Stream.Stream<EnvelopeApi.Envelope<TEvent>, never>;

    readonly unsafePublish: <TEvent extends AnyEvent>(
      event: TEvent,
      payload: TEvent[typeof InferPayloadTypeId],
    ) => boolean;
  }
>() {}

/** Try to get the EventBus from context, returning `undefined` if absent. */
const getOrUndefined = pipe(Effect.serviceOption(EventBus), Effect.map(Option.getOrUndefined));

/** Get the EventBus from context, failing with {@link EventBusNotFoundError} if absent. */
const getOrFail = pipe(
  Effect.serviceOption(EventBus),
  Effect.flatMap(
    Option.match({
      onNone: () =>
        Effect.fail(
          new EventBusNotFoundError({
            message: 'EventBus service not provided. Use EventBus.layer or provide it manually.',
          }),
        ),
      onSome: (bus) => Effect.succeed(bus),
    }),
  ),
);

/**
 * Publish an event. Requires the EventBus service in context.
 *
 * Fails with {@link EventBusNotFoundError} if the bus is not provided.
 */
export function publish<TEvent extends AnyEvent>(
  event: TEvent,
  payload: TEvent[typeof InferPayloadTypeId],
): Effect.Effect<boolean, EventBusNotFoundError> {
  return pipe(
    getOrFail,
    Effect.andThen((s) => s.publish(event, payload)),
  );
}

export function subscribe<TEvent extends AnyEvent>(
  event: TEvent,
): Stream.Stream<EnvelopeApi.Envelope<AnyEvent>, EventBusNotFoundError> {
  return pipe(
    getOrFail,
    Effect.map((s) => s.subscribe(event)),
    Stream.unwrap,
  );
}

//TODO: publishWith/subscribeWith static function for a pipeable approach (dual fn)
//https://effect-ts.github.io/effect/effect/Function.ts.html#dual

/**
 * Non-failing variant of {@link publish}. Returns `Option.none()`
 * if the EventBus is not in context, or `Option.some(result)` with
 * the publish result if it is.
 */
export const publishOptional: <TEvent extends AnyEvent>(
  event: TEvent,
  payload: TEvent[typeof InferPayloadTypeId],
) => Effect.Effect<Option.Option<boolean>> = (event, payload) =>
  Effect.gen(function* () {
    const eventBus = yield* getOrUndefined;

    if (!eventBus) return Option.none();

    const result = yield* eventBus.publish(event, payload);
    return Option.some(result);
  });

/**
 * Non-failing variant of {@link subscribe}. Returns `Option.none()`
 * if the EventBus is not in context, or `Option.some(stream)` if it is.
 */
export const subscribeOptional: <TEvent extends AnyEvent>(
  event: TEvent,
) => Effect.Effect<
  Option.Option<Stream.Stream<EnvelopeApi.Envelope<TEvent>, never>>,
  never,
  never
> = (event) =>
  Effect.gen(function* () {
    const eventBus = yield* getOrUndefined;

    if (!eventBus) return Option.none();

    return Option.some(eventBus.subscribe(event));
  });

type MakeOptions = {
  readonly capacity?: number;
};

/**
 * Create an EventBus service backed by a bounded or unbounded {@link PubSub}.
 *
 * @param options.capacity - Max number of buffered events. If omitted, an
 *   unbounded queue is used (never blocks publishers).
 */
export const make = (options: MakeOptions = {}) =>
  Effect.gen(function* () {
    const bus = yield* options.capacity !== undefined
      ? PubSub.bounded<EnvelopeApi.Envelope<AnyEvent>>({ capacity: options.capacity })
      : PubSub.unbounded<EnvelopeApi.Envelope<AnyEvent>>();

    return EventBus.of({
      publish: (event, payload) =>
        Effect.gen(function* () {
          const envelope = EnvelopeApi.make({
            event,
            payload,
          });

          return yield* PubSub.publish(bus, envelope);
        }),
      subscribe: (expectedEvent) =>
        pipe(
          Stream.fromPubSub(bus),
          Stream.filter(
            (env): env is EnvelopeApi.Envelope<typeof expectedEvent> =>
              env.event.tag === expectedEvent.tag,
          ),
        ),
      unsafePublish(event, payload) {
        const envelope = EnvelopeApi.make({
          event,
          payload,
        });

        return bus.unsafeOffer(envelope);
      },
    });
  });

/**
 * Create an {@link Effect.Layer} providing the EventBus service.
 *
 * @example
 * ```ts
 * const layer = EventBus.layer({ capacity: 256 });
 * const program = Effect.provide(program, layer);
 * ```
 */
export const layer = (options: MakeOptions = {}) => Layer.effect(EventBus, make(options));

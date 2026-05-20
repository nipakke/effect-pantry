import { Effect, Context, PubSub, Stream, pipe, Layer, Option } from 'effect';
import * as Errors from './Errors.js';
import * as Event from './Event.js';
import * as EnvelopeApi from './Envelope.js';
import * as PayloadApi from './Payload.js';

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
    readonly publish: <TEvent extends Event.AnyEvent>(
      event: TEvent,
      input: TEvent[typeof Event.MetaTypeId]['input'],
    ) => Effect.Effect<boolean, Errors.SchemaParseError>;

    readonly subscribe: <TEvent extends Event.AnyEvent>(
      event: TEvent,
    ) => Stream.Stream<EnvelopeApi.Envelope<TEvent>>;

    readonly unsafePublish: <TEvent extends Event.AnyEvent>(
      event: TEvent,
      input: TEvent[typeof Event.MetaTypeId]['input'],
    ) => boolean;
  }
>() {}

/**
 * Get the EventBus from context as an `Option`, returning `none` when absent.
 *
 * @example
 * ```ts
 * const maybeBus = yield* EventBus.getOption;
 * ```
 */
export const getOption = Effect.serviceOption(EventBus);

/** Get the EventBus from context, failing with {@link EventBusNotFoundError} if absent. */
const getOrFail = pipe(
  getOption,
  Effect.flatMap(
    Option.match({
      onNone: () =>
        Effect.fail(
          new Errors.EventBusNotFoundError({
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
 * Validates the input through the event's payload schema before publishing.
 * Fails with {@link EventBusNotFoundError} if the bus is not provided,
 * or with {@link SchemaParseError} if the input fails schema validation.
 */
export function publish<TEvent extends Event.AnyEvent>(
  event: TEvent,
  input: TEvent[typeof Event.MetaTypeId]['input'],
): Effect.Effect<boolean, Errors.EventBusNotFoundError | Errors.SchemaParseError> {
  return pipe(
    getOrFail,
    Effect.andThen((s) => s.publish(event, input)),
  );
}

export function subscribe<TEvent extends Event.AnyEvent>(
  event: TEvent,
): Stream.Stream<EnvelopeApi.Envelope<TEvent>, Errors.EventBusNotFoundError> {
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
export const publishOptional: <TEvent extends Event.AnyEvent>(
  event: TEvent,
  input: TEvent[typeof Event.MetaTypeId]['input'],
) => Effect.Effect<Option.Option<boolean>, Errors.SchemaParseError> = (event, input) =>
  Effect.gen(function* () {
    const eventBus = yield* getOption;

    if (Option.isNone(eventBus)) return Option.none();

    const result = yield* eventBus.value.publish(event, input);
    return Option.some(result);
  });

/**
 * Non-failing variant of {@link subscribe}. Returns `Option.none()`
 * if the EventBus is not in context, or `Option.some(stream)` if it is.
 */
export const subscribeOptional: <TEvent extends Event.AnyEvent>(
  event: TEvent,
) => Effect.Effect<Option.Option<Stream.Stream<EnvelopeApi.Envelope<TEvent>>>> = (event) =>
  Effect.gen(function* () {
    const eventBus = yield* getOption;

    if (Option.isNone(eventBus)) return Option.none();

    return Option.some(eventBus.value.subscribe(event));
  });

type MakeOptions = {
  /** Max number of buffered events. Omit for unbounded (recommended). */
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
      ? PubSub.bounded<EnvelopeApi.Envelope<Event.AnyEvent>>({ capacity: options.capacity })
      : PubSub.unbounded<EnvelopeApi.Envelope<Event.AnyEvent>>();

    return EventBus.of({
      publish: (event, input) =>
        Effect.gen(function* () {
          const payload = yield* PayloadApi.parse(event.payload, input);

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
      unsafePublish(event, input) {
        const payload = PayloadApi.parseSync<EnvelopeApi.ExtractPayload<typeof event>>(
          event.payload,
          input,
        );

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

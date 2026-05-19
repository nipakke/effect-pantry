import { StandardSchemaV1 } from '@standard-schema/spec';
import { Effect, Context, PubSub, Stream, Schema, pipe, Layer, Option } from 'effect';
import { EventValidationError, EventPublishError, EventBusNotFoundError } from './errors.js';
import { AnyEvent, AnyPayload } from './Event.js';
import * as EnvelopeApi from './Envelope.js';

// ── Validation helper ─────────────────────────────────────────────────

/**
 * Validate an event payload against its schema.
 *
 * Uses {@link Schema.decodeUnknown} for Effect schemas (handles
 * transforms, refinements, and context requirements) and falls back to
 * the {@link https://standardschema.dev StandardSchemaV1} protocol for
 * third-party schemas (Zod, Valibot, ArkType, etc.). Returns the
 * validated output on success, or an {@link EventValidationError} on
 * failure.
 */
const validatePayload = <TEvent extends AnyEvent>(
  event: TEvent,
  value: unknown,
): Effect.Effect<unknown, EventValidationError, never> => {
  if (Schema.isSchema(event.payload)) {
    return pipe(
      Schema.decodeUnknown(event.payload)(value),
      Effect.mapError(
        (cause) => new EventValidationError({ eventTag: event.tag, cause }),
      ),
    ) as Effect.Effect<unknown, EventValidationError, never>;
  }

  // StandardSchemaV1 (non-Effect) — handle both sync and async validation
  return Effect.gen(function* () {
    const result = (event.payload as StandardSchemaV1)['~standard'].validate(value);
    const resolved = result instanceof Promise ? yield* Effect.promise(() => result) : result;

    if (!('value' in resolved)) {
      return yield* Effect.fail(
        new EventValidationError({ eventTag: event.tag, cause: resolved.issues }),
      );
    }

    return resolved.value;
  });
};

// ── EventBus service ──────────────────────────────────────────────────

type BusError = EventValidationError | EventPublishError | EventBusNotFoundError;

/**
 * In-memory typed event bus backed by Effect's {@link PubSub}.
 *
 * Provides publish/subscribe with per-event-tag filtering, runtime
 * payload validation, and both fail-fast and optional access patterns.
 *
 * Static methods require the EventBus service in the Effect context.
 * Provide it via {@link EventBus.layer} or manually.
 */
export class EventBus extends Context.Tag('@effect-pantry/events/EventBus')<
  EventBus,
  {
    readonly publish: <TEvent extends AnyEvent>(
      event: TEvent,
      payload: TEvent['~inferPayload'],
    ) => Effect.Effect<boolean, BusError>;
    readonly subscribe: <TEvent extends AnyEvent>(
      event: TEvent,
    ) => Stream.Stream<EnvelopeApi.Envelope<TEvent>, EventBusNotFoundError>;
  }
>() {
  /** Try to get the EventBus from context, returning `undefined` if absent. */
  private static getOrUndefined = pipe(
    Effect.serviceOption(EventBus),
    Effect.map(Option.getOrUndefined),
  );

  /** Get the EventBus from context, failing with {@link EventBusNotFoundError} if absent. */
  private static getOrFail = pipe(
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
   * Validates the payload against the event's schema before publishing.
   * Fails with {@link EventBusNotFoundError} if the bus is not provided,
   * or {@link EventValidationError} if the payload is invalid.
   */
  static publish: <TEvent extends AnyEvent>(
    event: TEvent,
    payload: TEvent['~inferPayload'],
  ) => Effect.Effect<boolean, BusError> = (event, payload) =>
    pipe(
      EventBus.getOrFail,
      Effect.andThen((s) => s.publish(event, payload)),
    );

  /**
   * Subscribe to events matching the given tag.
   *
   * Returns a {@link Stream} of {@link Envelope} objects filtered to
   * only the matching event tag. Requires the EventBus service in context.
   * Fails with {@link EventBusNotFoundError} if not provided.
   */
  static subscribe: <TEvent extends AnyEvent>(
    event: TEvent,
  ) => Stream.Stream<EnvelopeApi.Envelope<TEvent>, EventBusNotFoundError> = (event) =>
    pipe(
      EventBus.getOrFail,
      Effect.map((s) => s.subscribe(event)),
      Stream.unwrap,
    );

  /**
   * Non-failing variant of {@link publish}. Returns `Option.none()`
   * if the EventBus is not in context, or `Option.some(result)` with
   * the publish result if it is.
   */
  static publishOptional: <TEvent extends AnyEvent>(
    event: TEvent,
    payload: TEvent['~inferPayload'],
  ) => Effect.Effect<Option.Option<boolean>, BusError, never> = (event, payload) =>
    Effect.gen(function* () {
      const eventBus = yield* EventBus.getOrUndefined;

      if (!eventBus) return Option.none();

      const result = yield* eventBus.publish(event, payload);
      return Option.some(result);
    });

  /**
   * Non-failing variant of {@link subscribe}. Returns `Option.none()`
   * if the EventBus is not in context, or `Option.some(stream)` if it is.
   */
  static subscribeOptional: <TEvent extends AnyEvent>(
    event: TEvent,
  ) => Effect.Effect<
    Option.Option<Stream.Stream<EnvelopeApi.Envelope<TEvent>, EventBusNotFoundError>>,
    never,
    never
  > = (event) =>
    Effect.gen(function* () {
      const eventBus = yield* EventBus.getOrUndefined;

      if (!eventBus) return Option.none();

      return Option.some(eventBus.subscribe(event));
    });
}

// ── Factory ───────────────────────────────────────────────────────────

type MakeOptions = {
  readonly capacity?: number;
};

/**
 * Create an EventBus service backed by a bounded {@link PubSub}.
 *
 * @param options.capacity - Max number of buffered events (default: `Infinity`)
 */
export const make = (options: MakeOptions) =>
  Effect.gen(function* () {
    const bus = yield* PubSub.bounded<EnvelopeApi.Envelope<AnyEvent>>({
      capacity: options.capacity ?? Infinity,
    });

    return EventBus.of({
      publish: (event, payload) =>
        Effect.gen(function* () {
          const validated = yield* validatePayload(event, payload);

          const envelope = EnvelopeApi.make({
            event,
            payload: validated,
          });

          return yield* PubSub.publish(bus, envelope);
        }),
      subscribe: (expectedEvent) =>
        pipe(
          Stream.fromPubSub(bus),
          Stream.filter((inc) => inc.event.tag === expectedEvent.tag),
          Stream.map((env) => env as EnvelopeApi.Envelope<typeof expectedEvent>),
        ),
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
export const layer = (options: MakeOptions) => Layer.effect(EventBus, make(options));

// Re-export static methods as module-level named exports
export const publish = EventBus.publish;
export const subscribe = EventBus.subscribe;
export const publishOptional = EventBus.publishOptional;
export const subscribeOptional = EventBus.subscribeOptional;

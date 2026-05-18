import { StandardSchemaV1 } from '@standard-schema/spec';
import { Effect, Context, PubSub, Stream, Schema, pipe, Random, Layer, Option } from 'effect';
import { EventValidationError, EventPublishError } from './errors.js';
import { AnyEvent, AnyPayload, Event, InferPayload } from './Event.js';
import * as EnvelopeApi from './Envelope.js';

interface Publish {
  /**
   * Returns true if published
   *
   * @returns boolean
   */
  <TEvent extends AnyEvent>(
    event: TEvent,
    payload: TEvent['~inferPayload'],
  ): Effect.Effect<boolean, EventValidationError | EventPublishError>;
}

interface Subscribe {
  <TEvent extends AnyEvent>(event: TEvent): Stream.Stream<EnvelopeApi.Envelope<TEvent>>;
}

export class EventBus extends Context.Tag('@effect-pantry/events/EventBus')<
  EventBus,
  {
    readonly publish: Publish;
    readonly subscribe: Subscribe;
  }
>() {
  private static getOrUndefined = pipe(
    Effect.serviceOption(EventBus),
    Effect.map(Option.getOrUndefined),
  );

  private static getOrFail = pipe(
    Effect.serviceOption(EventBus),
    Effect.map(Option.getOrThrowWith(() => Effect.fail('TODO: Implement error'))),
  );

  static publish: Publish = (event, payload) =>
    pipe(
      EventBus.getOrFail,
      Effect.andThen((s) => s.publish(event, payload)),
    );

  static subscribe: Subscribe = (event) =>
    pipe(
      EventBus.getOrFail,
      Effect.map((s) => s.subscribe(event)),
      Stream.unwrap,
    );

  static publishOptional: Publish = (event, payload) =>
    Effect.gen(function* () {
      const eventBus = yield* EventBus.getOrUndefined;

      if (!eventBus) return false;

      return yield* eventBus.publish(event, payload);
    });

  static subscribeOptional: Subscribe = () =>
    Effect.gen(function* () {
      const eventBus = yield* EventBus.getOrUndefined;
      yield* Effect.die('[subscribeOptional] not implemented');
      return Stream.empty;
    }).pipe(Stream.unwrap);
}

type MakeOptions = {
  readonly capacity?: number;
};

export const make = (options: MakeOptions) =>
  Effect.gen(function* () {
    const bus = yield* PubSub.bounded<EnvelopeApi.Envelope<AnyEvent>>({
      capacity: options.capacity ?? Infinity,
    });

    //TODO: Errors
    return EventBus.of({
      publish: (event, payload) =>
        Effect.gen(function* () {
          const envelope = EnvelopeApi.make({
            event,
            payload,
          });

          //TODO: Fork maybe
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

export const layer = (options: MakeOptions) => Layer.effect(EventBus, make(options));

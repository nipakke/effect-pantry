import { Predicate, Schema } from 'effect';
import { InferPayloadTypeId, AnyPayload, InferPayload } from './Payload.js';

/**
 * Brand symbol for Event instances. Used by {@link isEvent} to
 * distinguish Event objects from plain values at runtime.
 */
export const TypeId: unique symbol = Symbol.for('@effect-pantry/events/Event');

export type TypeId = typeof TypeId;

/**
 * A typed event definition.
 *
 * Created via {@link Event.make} — carries a string tag and an optional
 * payload schema.
 *
 * @typeParam Tag - Discriminant string tag (e.g. `"user.created"`)
 * @typeParam Payload - Schema used to infer the event payload
 */
export interface Event<
  out Tag extends string,
  in out Payload extends AnyPayload = typeof Schema.Void,
> {
  readonly [InferPayloadTypeId]: InferPayload<Payload>;
  readonly [TypeId]: TypeId;
  readonly tag: Tag;
  readonly payload: Payload;
}

export type AnyEvent = Event<any, any>;

/**
 * Runtime type guard: checks whether a value is an {@link Event} instance.
 */
export const isEvent = (u: unknown): u is Event<any, any> => Predicate.hasProperty(u, TypeId);

const Proto = { [TypeId]: TypeId };

/**
 * Create a new event definition.
 *
 * @example
 * ```ts
 * const UserCreated = Event.make({
 *   tag: 'user.created',
 *   payload: Schema.Struct({ id: Schema.String, name: Schema.String }),
 * });
 * ```
 *
 * @param options.tag - Unique string identifier for the event
 * @param options.payload - Schema for the event payload (defaults to `Schema.Void`)
 */
export const make = <Tag extends string, Payload extends AnyPayload = typeof Schema.Void>(options: {
  readonly tag: Tag;
  readonly payload?: Payload;
}): Event<Tag, Payload> => {
  const self = {
    payload: (options.payload ?? Schema.Void) as Payload,
    tag: options.tag,
  } satisfies Omit<Event<Tag, Payload>, typeof InferPayloadTypeId | TypeId>;

  return Object.assign(Object.create(Proto), self);
};

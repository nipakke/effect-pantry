import { Predicate, Schema } from 'effect';
import * as Payload from './Payload.js';

/**
 * Brand symbol for Event instances. Used by {@link isEvent} to
 * distinguish Event objects from plain values at runtime.
 */
export const TypeId: unique symbol = Symbol.for('@effect-pantry/events/Event');

export type TypeId = typeof TypeId;

/**
 * Meta typeid — single access point for system-level event metadata.
 *
 * All internal machinery (payload schema, inferred type, etc.) lives
 * behind this symbol so the `Event` interface stays clean and
 * extensible for future system-level additions.
 */
export const MetaTypeId: unique symbol = Symbol.for('@effect-pantry/events/Event.Meta');

export type MetaTypeId = typeof MetaTypeId;

/**
 * System-level metadata attached to every {@link Event}.
 *
 * Holds phantom type information (inferred input/output types) and
 * any future internal fields the framework needs — things *added by the
 * system*, not the user. User-facing properties like {@link Event.payload}
 * live directly on the {@link Event} interface.
 */
export interface EventMeta<Payload extends Payload.AnyPayload> {
  /** Phantom type for the output (decoded) type — what subscribers receive. */
  readonly output: Payload.InferPayloadOutput<Payload>;
  /** Phantom type for the input (encoded) type — what publishers provide. */
  readonly input: Payload.InferPayloadInput<Payload>;
}

/**
 * A typed event definition.
 *
 * Created via {@link Event.make} — carries a string tag and an optional
 * payload schema. System-level metadata (inferred type, etc.) lives
 * behind the {@link MetaTypeId} symbol.
 *
 * @typeParam Tag - Discriminant string tag (e.g. `"user.created"`)
 * @typeParam Payload - Schema used to infer the event payload
 */
export interface Event<
  out Tag extends string,
  in out Payload extends Payload.AnyPayload = typeof Schema.Void,
> {
  readonly [MetaTypeId]: EventMeta<Payload>;
  readonly [TypeId]: TypeId;
  readonly tag: Tag;
  readonly payload: Payload;
}

export type AnyEvent = Event<any, any>;

/**
 * Runtime type guard: checks whether a value is an {@link Event} instance.
 */
export const isEvent = (u: unknown): u is AnyEvent => Predicate.hasProperty(u, TypeId);

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
export const make = <
  Tag extends string,
  Payload extends Payload.AnyPayload = typeof Schema.Void,
>(options: {
  readonly tag: Tag;
  readonly payload?: Payload;
}): Event<Tag, Payload> => {
  const payload: Payload = (options.payload ?? Schema.Void) as Payload;
  const self = {
    tag: options.tag,
    payload,
    [MetaTypeId]: {} as EventMeta<Payload>,
  };
  return Object.assign(Object.create(Proto), self);
};

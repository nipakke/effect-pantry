import { StandardSchemaV1 } from '@standard-schema/spec';
import { Predicate, Schema } from 'effect';
import { pipeArguments } from 'effect/Pipeable';

/**
 * Brand symbol for Event instances. Used by {@link isEvent} to
 * distinguish Event objects from plain values at runtime.
 */
export const TypeId: unique symbol = Symbol.for('@effect-pantry/events/Event');

export type TypeId = typeof TypeId;

/**
 * Union of supported payload schema types. Accepts both Effect
 * {@link Schema.Schema} and framework-agnostic {@link StandardSchemaV1}
 * schemas (Zod, Valibot, ArkType, etc.).
 */
export type AnyPayload = Schema.Schema.Any | StandardSchemaV1;

/**
 * Extracts the validated output type from a payload schema.
 */
export type InferPayload<Payload extends AnyPayload> = Payload extends Schema.Schema.Any
  ? Schema.Schema.Type<Payload>
  : Payload extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Payload>
    : never;

/**
 * A typed event definition.
 *
 * Created via {@link Event.make} — carries a string tag and an optional
 * payload schema used for runtime validation on publish.
 *
 * @typeParam Tag - Discriminant string tag (e.g. `"user.created"`)
 * @typeParam Payload - Schema used to validate and infer the event payload
 */
export interface Event<
  out Tag extends string,
  in out Payload extends AnyPayload = typeof Schema.Void,
> {
  /** Phantom property for extracting the inferred payload type */
  ['~inferPayload']: InferPayload<Payload>;
  readonly [TypeId]: TypeId;
  readonly tag: Tag;
  readonly payload: Payload;
}

export type AnyEvent = Event<any, any>;

/**
 * Runtime type guard: checks whether a value is an {@link Event} instance.
 */
export const isEvent = (u: unknown): u is Event<any, any> => Predicate.hasProperty(u, TypeId);

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

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
  Payload extends Schema.Schema.Any | StandardSchemaV1 = typeof Schema.Void,
>(options: {
  readonly tag: Tag;
  readonly payload?: Payload;
}): Event<Tag, Payload> => {
  const self = {
    payload: (options.payload ?? Schema.Void) as Payload,
    tag: options.tag,
  } satisfies Omit<Event<Tag, Payload>, '~inferPayload' | TypeId | 'pipe'>;

  return Object.assign(Object.create(Proto), self);
};

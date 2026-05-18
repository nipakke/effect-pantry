import { StandardSchemaV1 } from '@standard-schema/spec';
import { Data, Effect, Predicate, Schema, Stream } from 'effect';
import { pipeArguments } from 'effect/Pipeable';
import { EventBus } from './EventBus.js';
export const TypeId: unique symbol = Symbol.for('@effect/experimental/Event');

export type TypeId = typeof TypeId;

export const isEvent = (u: unknown): u is Event<any, any> => Predicate.hasProperty(u, TypeId);

export type AnyPayload = Schema.Schema.Any | StandardSchemaV1;

export type InferPayload<Payload extends AnyPayload> = Payload extends Schema.Schema.Any
  ? Schema.Schema.Type<Payload>
  : Payload extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Payload>
    : never;

// export type InferEventPayload<T extends AnyEvent> = InferPayload<T["payload"]>

export interface Event<
  out Tag extends string,
  in out Payload extends AnyPayload = typeof Schema.Void,
> {
  ['~inferPayload']: InferPayload<Payload>;
  readonly [TypeId]: TypeId;
  readonly tag: Tag;
  readonly payload: Payload;
}

export type AnyEvent = Event<any, any>;

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

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

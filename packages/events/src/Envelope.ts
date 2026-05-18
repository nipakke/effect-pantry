import { Predicate } from 'effect';
import { AnyEvent } from './Event.js';
import { pipeArguments } from 'effect/Pipeable';

export const TypeId: unique symbol = Symbol.for('events/Envelope');

export type TypeId = typeof TypeId;

export const isEnvelope = (u: unknown): u is Envelope<any> => Predicate.hasProperty(u, TypeId);

export interface Envelope<out TEvent extends AnyEvent> {
  readonly [TypeId]: TypeId;
  readonly event: TEvent;
  readonly ts: number;

  readonly payload: TEvent['~inferPayload'];
}

export type WithoutBrand<T extends Envelope<any>> = Omit<T, TypeId>;

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

//TODO: Extend envelope
/*
const envelope: Envelope<string, unknown> = {
id: generateId(),
eventDefinition: event as Envelope<string, unknown>["eventDefinition"],
payload: validated,
ts: Date.now(),
*/
export const make = <T extends Envelope<any>>(envelope: Omit<T, TypeId | 'ts'>): T => {
  return Object.assign(Object.create(Proto), envelope, {
    ts: Date.now(),
  });
};

import { Predicate } from 'effect';
import { AnyEvent } from './Event.js';
import { pipeArguments } from 'effect/Pipeable';

/**
 * Brand symbol for Envelope instances.
 */
export const TypeId: unique symbol = Symbol.for('@effect-pantry/events/Envelope');

export type TypeId = typeof TypeId;

/**
 * Runtime type guard: checks whether a value is an {@link Envelope}.
 */
export const isEnvelope = (u: unknown): u is Envelope<any> => Predicate.hasProperty(u, TypeId);

/**
 * A published event wrapped with metadata.
 *
 * Carries the original event definition, the validated payload, a
 * unique id (UUID v4), and a Unix timestamp.
 */
export interface Envelope<out TEvent extends AnyEvent> {
  readonly [TypeId]: TypeId;
  /** Unique identifier for this event occurrence (UUID v4) */
  readonly id: string;
  /** The event definition that was published */
  readonly event: TEvent;
  /** Unix timestamp (milliseconds) of when the envelope was created */
  readonly ts: number;
  /** The validated payload matching the event's schema */
  readonly payload: TEvent['~inferPayload'];
}

/** Strip the brand symbol from an Envelope type. */
export type WithoutBrand<T extends Envelope<any>> = Omit<T, TypeId>;

const Proto = {
  [TypeId]: TypeId,
  pipe() {
    return pipeArguments(this, arguments);
  },
};

/**
 * Create an envelope for a published event.
 *
 * Automatically generates a UUID v4 id and sets the timestamp.
 */
export const make = <T extends Envelope<any>>(envelope: Omit<T, TypeId | 'id' | 'ts'>): T => {
  return Object.assign(Object.create(Proto), envelope, {
    id: globalThis.crypto.randomUUID(),
    ts: Date.now(),
  });
};

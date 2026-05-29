/**
 * @effect-pantry/events — Type-safe in-memory event bus for Effect-TS.
 *
 * Provides typed event definitions with branded {@link Event} objects,
 * schema-validated payloads, and a {@link EventBus} service backed by
 * Effect's PubSub for publish/subscribe.
 *
 * **⚠️ Early-stage package** — APIs may change without notice.
 * Not recommended for production use yet.
 *
 * @module
 */

export { isEvent } from './Event.js';
export type { Event, AnyEvent } from './Event.js';
export {
  EventBus,
  publish,
  subscribe,
  publishOptional,
  subscribeOptional,
  getOption,
  layer,
} from './EventBus.js';
export { isEnvelope } from './Envelope.js';
export type { Envelope, ExtractPayload, WithoutBrand } from './Envelope.js';

export { make as makeEvent } from './Event.js';
export { make as makeEventBus } from './EventBus.js';
export { make as makeEnvelope } from './Envelope.js';

export { EventBusNotFoundError, SchemaParseError } from './Errors.js';
export type { AnyPayload, InferPayloadOutput, InferPayloadInput } from './Payload.js';

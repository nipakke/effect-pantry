import { Data } from 'effect';

/**
 * Payload validation failed when emitting an event.
 */
export class EventValidationError extends Data.TaggedError('EventValidationError')<{
  readonly eventTag: string;
  readonly cause: unknown;
}> {}

/**
 * An event publish operation failed.
 */
export class EventPublishError extends Data.TaggedError('EventPublishError')<{
  readonly eventTag: string;
  readonly cause: unknown;
}> {}

/**
 * Union of all event bus errors for exhaustive matching in Effect signatures.
 */
export type EventBusError = EventValidationError | EventPublishError;

import { Data } from 'effect';

/**
 * The EventBus service was not provided to the Effect runtime.
 */
export class EventBusNotFoundError extends Data.TaggedError('EventBusNotFoundError')<{
  readonly message: string;
}> {}

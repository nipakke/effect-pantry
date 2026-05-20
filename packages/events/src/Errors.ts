import { Data } from 'effect';

/**
 * The EventBus service was not provided to the Effect runtime.
 */
export class EventBusNotFoundError extends Data.TaggedError('EventBusNotFoundError')<{
  readonly message: string;
}> {}

/**
 * Validation of the event payload through the schema failed.
 *
 * The `schema` field holds the schema that produced the error, enabling
 * callers to inspect or recover the schema at runtime.
 */
export class SchemaParseError extends Data.TaggedError('SchemaParseError')<{
  readonly message: string;
  readonly schema: unknown;
}> {}

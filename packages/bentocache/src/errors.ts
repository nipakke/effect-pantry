import { Data } from 'effect';

export class BentoCacheError extends Data.TaggedError('BentoCacheError')<{
  readonly cause: unknown;
  readonly message: string;
  readonly key?: string | undefined;
}> {}

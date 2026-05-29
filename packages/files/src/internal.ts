import { Effect } from "effect";
import { toStorageError } from "./errors.js";

/** @internal */
export const wrap = <A>(fn: (signal: AbortSignal) => Promise<A>) =>
  Effect.tryPromise({ try: fn, catch: toStorageError });

import { StandardSchemaV1 } from '@standard-schema/spec';
import { Effect, Schema } from 'effect';
import * as Errors from './Errors.js';

/**
 * Union of supported payload schema types. Accepts both Effect
 * {@link Schema.Schema} and framework-agnostic {@link StandardSchemaV1}
 * schemas (Zod, Valibot, ArkType, etc.).
 */
export type AnyPayload = Schema.Schema.Any | StandardSchemaV1;

/**
 * Extracts the inferred **output** (decoded) type from a payload schema.
 *
 * This is the type subscribers receive in the {@link Envelope}.
 */
export type InferPayloadOutput<P extends AnyPayload> = P extends Schema.Schema.Any
  ? Schema.Schema.Type<P>
  : P extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<P>
    : never;

/**
 * Extracts the inferred **input** (encoded) type from a payload schema.
 *
 * This is the type publishers provide to {@link EventBus.publish}.
 */
export type InferPayloadInput<P extends AnyPayload> = P extends Schema.Schema.Any
  ? Schema.Schema.Encoded<P>
  : P extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<P>
    : never;

// ── Runtime helpers ────────────────────────────────────────────────────

const isEffectSchema = (u: unknown): u is Schema.Schema.Any =>
  (typeof u === 'object' || typeof u === 'function') && u !== null && Schema.TypeId in u;

const isStandardSchema = (u: unknown): u is StandardSchemaV1 =>
  typeof u === 'object' &&
  u !== null &&
  '~standard' in u &&
  typeof (u as StandardSchemaV1)['~standard']?.validate === 'function';

/**
 * Validate and transform an input value through the given payload schema.
 *
 * Handles both Effect {@link Schema.Schema} and framework-agnostic
 * {@link StandardSchemaV1} schemas at runtime.
 *
 * @example
 * ```ts
 * const payload = yield* Payload.parse(Schema.DateFromString, '2024-01-01');
 * // payload is Date
 * ```
 */
export const parse = <S extends AnyPayload, A extends InferPayloadOutput<S>, I>(
  schema: S,
  input: I,
): Effect.Effect<A, Errors.SchemaParseError> =>
  Effect.suspend(() => {
    if (isEffectSchema(schema)) {
      return Schema.decodeUnknown(schema)(input).pipe(
        Effect.mapError(
          (issue) =>
            new Errors.SchemaParseError({
              message: issue.message,
              schema,
            }),
        ),
      ) as Effect.Effect<A, Errors.SchemaParseError>;
    }
    if (isStandardSchema(schema)) {
      const result = schema['~standard'].validate(input);
      const resolved = result instanceof Promise ? result : Promise.resolve(result);
      return Effect.promise(() => resolved).pipe(
        Effect.flatMap((r) =>
          'issues' in r
            ? Effect.fail(
                new Errors.SchemaParseError({
                  message: r.issues?.map((i) => i.message).join(', ') ?? 'Validation failed',
                  schema,
                }),
              )
            : Effect.succeed(r.value as A),
        ),
      );
    }

    const schemaDescription =
      schema === null
        ? 'null'
        : schema === undefined
          ? 'undefined'
          : `object with constructor ${(schema as object).constructor?.name ?? '<unknown>'}`;

    return Effect.fail(
      new Errors.SchemaParseError({
        message: `Unrecognized schema: expected an Effect Schema, StandardSchemaV1, or similar — received ${schemaDescription}`,
        schema,
      }),
    );
  });

/**
 * Synchronous variant of {@link parse}. Throws {@link Errors.SchemaParseError}
 * if validation fails.
 *
 * For {@link StandardSchemaV1} schemas that return asynchronous validation
 * results, this throws with an explanatory error.
 */
export const parseSync = <A>(schema: AnyPayload, input: unknown): A => {
  if (isEffectSchema(schema)) {
    try {
      return Schema.decodeSync(schema as Schema.Schema<any, any, never>)(input as never) as A;
    } catch (e: unknown) {
      throw new Errors.SchemaParseError({
        message: e instanceof Error ? e.message : String(e),
        schema,
      });
    }
  }
  if (isStandardSchema(schema)) {
    const result = schema['~standard'].validate(input);
    if (result instanceof Promise) {
      throw new Errors.SchemaParseError({
        message:
          'StandardSchemaV1 validate returned an async result; ' +
          'use the Effect-based publish() instead of unsafePublish()',
        schema,
      });
    }
    if ('issues' in result) {
      throw new Errors.SchemaParseError({
        message: result.issues?.map((i) => i.message).join(', ') ?? 'Validation failed',
        schema,
      });
    }
    return result.value as A;
  }
  // Unrecognised schema type — pass through
  return input as A;
};

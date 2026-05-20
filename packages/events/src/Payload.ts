import { StandardSchemaV1 } from '@standard-schema/spec';
import { Schema } from 'effect';

/**
 * Union of supported payload schema types. Accepts both Effect
 * {@link Schema.Schema} and framework-agnostic {@link StandardSchemaV1}
 * schemas (Zod, Valibot, ArkType, etc.).
 */
export type AnyPayload = Schema.Schema.Any | StandardSchemaV1;

/**
 * Extracts the output type from a payload schema.
 */
export type InferPayload<Payload extends AnyPayload> = Payload extends Schema.Schema.Any
  ? Schema.Schema.Type<Payload>
  : Payload extends StandardSchemaV1
    ? StandardSchemaV1.InferOutput<Payload>
    : never;
import { it, expect } from '@effect/vitest';
import { Effect, Either, Schema } from 'effect';
import { StandardSchemaV1 } from '@standard-schema/spec';
import * as Payload from '../src/Payload.js';
import * as Errors from '../src/Errors.js';

// ── StandardSchema mocks ─────────────────────────────────────────────

const validStdSchema: StandardSchemaV1<string, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => ({ value: String(value) }),
  },
};

const invalidStdSchema: StandardSchemaV1<string, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: () => ({ issues: [{ message: 'test validation error' }] }),
  },
};

const asyncStdSchema: StandardSchemaV1<string, string> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value: unknown) => Promise.resolve({ value: String(value) }),
  },
};

// ═════════════════════════════════════════════════════════════════════
// Payload.parse tests
// ═════════════════════════════════════════════════════════════════════

it.effect('Payload.parse with valid Effect Schema decodes successfully', () =>
  Effect.gen(function* () {
    const result = yield* Payload.parse(Schema.String, 'hello');
    expect(result).toBe('hello');
  }),
);

it.effect('Payload.parse with Schema.Struct decodes objects', () =>
  Effect.gen(function* () {
    const result = yield* Payload.parse(
      Schema.Struct({ id: Schema.String, count: Schema.Number }),
      { id: 'abc', count: 42 },
    );
    expect(result).toEqual({ id: 'abc', count: 42 });
  }),
);

it.effect('Payload.parse with Schema.Void decodes undefined', () =>
  Effect.gen(function* () {
    const result = yield* Payload.parse(Schema.Void, undefined);
    expect(result).toBeUndefined();
  }),
);

it.effect('Payload.parse with invalid Effect Schema fails with SchemaParseError', () =>
  Effect.gen(function* () {
    const schema = Schema.Number;
    const result = yield* Effect.either(Payload.parse(schema, 'not-a-number'));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Errors.SchemaParseError);
      expect(result.left.schema).toBe(schema);
    }
  }),
);

it.effect('Payload.parse with valid StandardSchema decodes successfully', () =>
  Effect.gen(function* () {
    const result = yield* Payload.parse(validStdSchema, 42);
    expect(result).toBe('42');
  }),
);

it.effect('Payload.parse with invalid StandardSchema fails with SchemaParseError', () =>
  Effect.gen(function* () {
    const result = yield* Effect.either(Payload.parse(invalidStdSchema, 'test'));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Errors.SchemaParseError);
      expect(result.left.message).toBe('test validation error');
      expect(result.left.schema).toBe(invalidStdSchema);
    }
  }),
);

it.effect('Payload.parse with async StandardSchema resolves successfully', () =>
  Effect.gen(function* () {
    const result = yield* Payload.parse(asyncStdSchema, 99);
    expect(result).toBe('99');
  }),
);

it.effect('Payload.parse with unrecognised schema fails with SchemaParseError', () =>
  Effect.gen(function* () {
    const unknownSchema = { foo: 'bar' } as unknown as Payload.AnyPayload;
    const result = yield* Effect.either(Payload.parse(unknownSchema, 'passthrough'));
    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Errors.SchemaParseError);
      expect(result.left.schema).toBe(unknownSchema);
      expect(result.left.message).toMatch(/Unrecognized schema/);
      expect(result.left.message).toMatch(/constructor Object/);
    }
  }),
);

// ═════════════════════════════════════════════════════════════════════
// Payload.parseSync tests
// ═════════════════════════════════════════════════════════════════════

it('Payload.parseSync with valid Effect Schema decodes synchronously', () => {
  const result = Payload.parseSync(Schema.String, 'hello');
  expect(result).toBe('hello');
});

it('Payload.parseSync with Schema.Struct decodes objects', () => {
  const result = Payload.parseSync(Schema.Struct({ id: Schema.String, count: Schema.Number }), {
    id: 'abc',
    count: 42,
  });
  expect(result).toEqual({ id: 'abc', count: 42 });
});

it('Payload.parseSync with invalid Effect Schema throws SchemaParseError', () => {
  expect(() => Payload.parseSync(Schema.Number, 'not-a-number')).toThrow(Errors.SchemaParseError);
});

it('Payload.parseSync with valid StandardSchema returns decoded value', () => {
  const result = Payload.parseSync(validStdSchema, 42);
  expect(result).toBe('42');
});

it('Payload.parseSync with invalid StandardSchema throws SchemaParseError', () => {
  expect(() => Payload.parseSync(invalidStdSchema, 'test')).toThrow(Errors.SchemaParseError);
});

it('Payload.parseSync with async StandardSchema throws with explanatory message', () => {
  expect(() => Payload.parseSync(asyncStdSchema, 99)).toThrow(Errors.SchemaParseError);
  try {
    Payload.parseSync(asyncStdSchema, 99);
  } catch (e) {
    expect(e).toBeInstanceOf(Errors.SchemaParseError);
    expect((e as Errors.SchemaParseError).message).toMatch(/async/);
    expect((e as Errors.SchemaParseError).schema).toBe(asyncStdSchema);
  }
});

it('Payload.parseSync with unrecognised schema returns input as-is', () => {
  const unknownSchema = { bar: 'baz' } as unknown as Payload.AnyPayload;
  const result = Payload.parseSync(unknownSchema, 'passthrough');
  expect(result).toBe('passthrough');
});

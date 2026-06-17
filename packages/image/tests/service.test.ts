import { it, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import {
  Image,
  layer,
  ImageAdapter,
  ImagePipeline,
} from "../src/index.js";
import type { ImageAdapterInterface } from "../src/adapter.js";

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

const mockAdapter: ImageAdapterInterface = {
  capabilities: new Set(["resize", "grayscale"]),
  execute: (_input, _ops) => Effect.succeed(Buffer.from("mock-output")),
  metadata: (_input) =>
    Effect.succeed({ format: "jpeg", width: 100, height: 100 }),
};

// ---------------------------------------------------------------------------
// Test layer
// ---------------------------------------------------------------------------

const TestLayer = layer().pipe(
  Layer.provide(Layer.succeed(ImageAdapter, mockAdapter)),
);

// ---------------------------------------------------------------------------
// Image service tests
// ---------------------------------------------------------------------------

it.layer(TestLayer)("Image", (it) => {
  // -------------------------------------------------------------------
  // fromBuffer
  // -------------------------------------------------------------------

  it.scoped("fromBuffer() returns an ImagePipeline", () =>
    Effect.gen(function* () {
      const image = yield* Image;
      const pipeline = image.fromBuffer(Buffer.from("test-data"));

      expect(pipeline).toBeInstanceOf(ImagePipeline);
    }),
  );

  it.scoped("fromBuffer() creates a pipeline bound to the adapter", () =>
    Effect.gen(function* () {
      const image = yield* Image;
      const pipeline = image.fromBuffer(Buffer.from("test-data"));

      // The pipeline should be usable — chaining ops and producing output
      pipeline.resize(100, 100).grayscale();
      const result = yield* pipeline.toBuffer();

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toBe("mock-output");
    }),
  );

  it.scoped("fromBuffer() pipeline respects adapter capabilities", () =>
    Effect.gen(function* () {
      const image = yield* Image;

      // Construct pipeline and attempt unsupported op
      const pipeline = image.fromBuffer(Buffer.from("test-data"));

      // The mock adapter does NOT support "blur" — should fail eagerly
      expect(() => pipeline.blur(1.0)).toThrow();
    }),
  );

  // -------------------------------------------------------------------
  // fromFile
  // -------------------------------------------------------------------

  it.scoped("fromFile() returns an Effect of ImagePipeline", () =>
    Effect.gen(function* () {
      const image = yield* Image;
      const effect = image.fromFile("/nonexistent/path.png");

      // fromFile with a real path would try to read it;
      // verify the return type is an Effect (has pipe method)
      expect(typeof (effect as unknown as Record<string, unknown>).pipe).toBe(
        "function",
      );
    }),
  );

  // -------------------------------------------------------------------
  // fromStream
  // -------------------------------------------------------------------

  it.scoped("fromStream() returns an Effect", () =>
    Effect.gen(function* () {
      const image = yield* Image;

      // Minimal web ReadableStream mock — won't actually produce data,
      // but we only need to verify the return type
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });
      const effect = image.fromStream(stream);

      expect(typeof (effect as unknown as Record<string, unknown>).pipe).toBe(
        "function",
      );
    }),
  );

  // -------------------------------------------------------------------
  // metadata
  // -------------------------------------------------------------------

  it.scoped("metadata() delegates to adapter.metadata()", () =>
    Effect.gen(function* () {
      const image = yield* Image;
      const result = yield* image.metadata(Buffer.from("test-data"));

      expect(result).toEqual({ format: "jpeg", width: 100, height: 100 });
    }),
  );

  it.scoped("metadata() returns an Effect", () =>
    Effect.gen(function* () {
      const image = yield* Image;
      const effect = image.metadata(Buffer.from("test-data"));

      expect(typeof (effect as unknown as Record<string, unknown>).pipe).toBe(
        "function",
      );
    }),
  );
});

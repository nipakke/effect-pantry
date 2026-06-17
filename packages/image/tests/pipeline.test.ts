import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { ImagePipeline, UnsupportedOpError } from "../src/index.js";
import type { ImageAdapterInterface } from "../src/adapter.js";
import type { ImageOp } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testInput = Buffer.from("fake-image-data");

/**
 * Create a mock adapter that records every operation passed to `execute`
 * so tests can inspect what the pipeline accumulated.
 */
const makeMock = (caps: string[]) => {
  let captured: ImageOp[] = [];
  const adapter: ImageAdapterInterface = {
    capabilities: new Set(caps),
    execute: (_input, ops) => {
      captured = [...ops];
      return Effect.succeed(Buffer.from("mock-output"));
    },
    metadata: (_input) =>
      Effect.succeed({ format: "jpeg", width: 100, height: 100 }),
  };
  return { adapter, getCaptured: () => captured };
};

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

describe("ImagePipeline", () => {
  it("creates with adapter and input", () => {
    const { adapter } = makeMock([]);
    const pipeline = new ImagePipeline(adapter, testInput);
    expect(pipeline).toBeInstanceOf(ImagePipeline);
  });

  // -----------------------------------------------------------------------
  // Op accumulation — each mutating method records the correct op
  // -----------------------------------------------------------------------

  it("resize() records a Resize op", () => {
    const { adapter, getCaptured } = makeMock(["resize"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.resize(200, 200, { fit: "cover" });
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Resize");
  });

  it("grayscale() records a Grayscale op", () => {
    const { adapter, getCaptured } = makeMock(["grayscale"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.grayscale();
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Grayscale");
  });

  it("convert() records a Format op", () => {
    const { adapter, getCaptured } = makeMock(["format"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.convert("webp");
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Format");
    if (ops[0]?._tag === "Format") {
      expect(ops[0].format).toBe("webp");
    }
  });

  it("crop() records a Crop op", () => {
    const { adapter, getCaptured } = makeMock(["crop"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.crop(10, 20, 100, 200);
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Crop");
  });

  it("rotate() records a Rotate op", () => {
    const { adapter, getCaptured } = makeMock(["rotate"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.rotate(90);
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Rotate");
  });

  it("flip() records a Flip op", () => {
    const { adapter, getCaptured } = makeMock(["flip"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.flip();
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Flip");
  });

  it("flop() records a Flop op", () => {
    const { adapter, getCaptured } = makeMock(["flop"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.flop();
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Flop");
  });

  it("blur() records a Blur op", () => {
    const { adapter, getCaptured } = makeMock(["blur"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.blur(1.5);
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Blur");
  });

  it("sharpen() records a Sharpen op", () => {
    const { adapter, getCaptured } = makeMock(["sharpen"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.sharpen();
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Sharpen");
  });

  it("negate() records a Negate op", () => {
    const { adapter, getCaptured } = makeMock(["negate"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.negate();
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Negate");
  });

  it("tint() records a Tint op", () => {
    const { adapter, getCaptured } = makeMock(["tint"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.tint(128, 64, 32);
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Tint");
  });

  it("effect() records an Effect op", () => {
    const { adapter, getCaptured } = makeMock(["effect"]);
    const pipeline = new ImagePipeline(adapter, testInput);
    const fn = (_img: unknown) => _img;

    pipeline.effect(fn);
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(1);
    expect(ops[0]?._tag).toBe("Effect");
  });

  // -----------------------------------------------------------------------
  // Chaining — multiple ops accumulate in order
  // -----------------------------------------------------------------------

  it("chains multiple ops correctly (resize → grayscale → convert)", () => {
    const { adapter, getCaptured } = makeMock([
      "resize",
      "grayscale",
      "format",
    ]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.resize(100, 100).grayscale().convert("png");
    Effect.runSync(pipeline.toBuffer());

    const ops = getCaptured();
    expect(ops).toHaveLength(3);
    expect(ops[0]?._tag).toBe("Resize");
    expect(ops[1]?._tag).toBe("Grayscale");
    expect(ops[2]?._tag).toBe("Format");
  });

  // -----------------------------------------------------------------------
  // Capability checking — fail fast on unsupported ops
  // -----------------------------------------------------------------------

  it("throws UnsupportedOpError when calling an unsupported operation", () => {
    const { adapter } = makeMock(["resize"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    expect(() => pipeline.blur(0.5)).toThrow(UnsupportedOpError);
  });

  it("UnsupportedOpError includes the operation name", () => {
    const { adapter } = makeMock([]);
    const pipeline = new ImagePipeline(adapter, testInput);

    try {
      pipeline.rotate(45);
      expect.fail("Expected UnsupportedOpError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedOpError);
      if (err instanceof UnsupportedOpError) {
        expect(err.op).toBe("rotate");
        expect(err.message).toContain("rotate");
      }
    }
  });

  // -----------------------------------------------------------------------
  // toBuffer — terminal method
  // -----------------------------------------------------------------------

  it("toBuffer() calls adapter.execute with accumulated ops", () => {
    const { adapter, getCaptured } = makeMock(["resize", "grayscale"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    pipeline.resize(50, 50).grayscale();
    expect(getCaptured()).toHaveLength(0); // not yet executed

    Effect.runSync(pipeline.toBuffer());
    expect(getCaptured()).toHaveLength(2);
  });

  it("toBuffer() returns the buffer produced by adapter.execute", () => {
    const { adapter } = makeMock(["resize"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    const result = Effect.runSync(pipeline.toBuffer());

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("mock-output");
  });

  it("toBuffer() validates ops before execution", () => {
    // adapter supports resize, but we mutate the capabilities set
    // after adding a resize op — this triggers validate() to fail
    const caps = new Set(["resize"]);
    const adapter: ImageAdapterInterface = {
      capabilities: caps,
      execute: () => Effect.succeed(Buffer.from("x")),
      metadata: () => Effect.succeed({}),
    };
    const pipeline = new ImagePipeline(adapter, testInput);
    pipeline.resize(100, 100);
    caps.delete("resize");

    expect(() => Effect.runSync(pipeline.toBuffer())).toThrow(
      UnsupportedOpError,
    );
  });

  // -----------------------------------------------------------------------
  // toFile — terminal method returns an Effect
  // -----------------------------------------------------------------------

  it("toFile() returns an Effect", () => {
    const { adapter } = makeMock(["resize"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    const result = pipeline.toFile("/tmp/out.png");

    // Effect instances have a pipe method
    expect(typeof (result as unknown as Record<string, unknown>).pipe).toBe("function");
  });

  // -----------------------------------------------------------------------
  // toStream — terminal method returns a Stream
  // -----------------------------------------------------------------------

  it("toStream() returns a Stream", () => {
    const { adapter } = makeMock(["resize"]);
    const pipeline = new ImagePipeline(adapter, testInput);

    const result = pipeline.toStream();

    // Stream instances have a pipe method
    expect(typeof (result as unknown as Record<string, unknown>).pipe).toBe("function");
  });
});

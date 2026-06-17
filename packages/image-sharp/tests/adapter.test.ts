/**
 * @module @effect-pantry/image-sharp/tests/adapter
 *
 * Comprehensive tests for {@link SharpAdapter} — the sharp-based
 * {@link @effect-pantry/image!ImageAdapterInterface} implementation.
 *
 * Tests cover capabilities, every image operation in the Op ADT,
 * metadata extraction, error handling, and Effect layer integration.
 * Synthetic test images are created via sharp's `create` API so no
 * fixture files are required.
 *
 * @see {@link SharpAdapter}
 */

import { describe, it, expect, beforeAll } from "vitest";
import { it as effectIt } from "@effect/vitest";
import { Effect, Exit } from "effect";
import sharp from "sharp";
import {
  SharpAdapter,
  Sharp,
} from "../src/index.js";
import {
  ImageAdapter,
  ImageAdapterError,
} from "@effect-pantry/image";
import type { ImageOp } from "@effect-pantry/image";

// ---------------------------------------------------------------------------
// Synthetic test images — created once per suite via sharp's create API
// ---------------------------------------------------------------------------

/** 100×100 semi-transparent red PNG (4 channels: RGBA). */
let redSquare: Buffer;

/** 100×200 opaque blue PNG (3 channels: RGB, no alpha). */
let blueRect: Buffer;

beforeAll(async () => {
  redSquare = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();

  blueRect = await sharp({
    create: {
      width: 100,
      height: 200,
      channels: 3,
      background: { r: 0, g: 0, b: 255 },
    },
  })
    .png()
    .toBuffer();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Resolve the metadata of a buffer via sharp for assertion purposes. */
const metaOf = (buf: Buffer) => sharp(buf).metadata();

// ---------------------------------------------------------------------------
// Adapter construction
// ---------------------------------------------------------------------------

describe("SharpAdapter", () => {
  it("can be constructed without dependencies", () => {
    const adapter = new SharpAdapter();
    expect(adapter).toBeInstanceOf(SharpAdapter);
  });

  it("implements the ImageAdapterInterface shape", () => {
    const adapter = new SharpAdapter();
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.metadata).toBe("function");
    expect(adapter.capabilities).toBeInstanceOf(Set);
  });
});

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

describe("SharpAdapter.capabilities", () => {
  it("returns a ReadonlySet of supported operation names", () => {
    const adapter = new SharpAdapter();
    const caps = adapter.capabilities;

    expect(caps.has("resize")).toBe(true);
    expect(caps.has("grayscale")).toBe(true);
    expect(caps.has("format")).toBe(true);
    expect(caps.has("crop")).toBe(true);
    expect(caps.has("rotate")).toBe(true);
    expect(caps.has("flip")).toBe(true);
    expect(caps.has("flop")).toBe(true);
    expect(caps.has("blur")).toBe(true);
    expect(caps.has("sharpen")).toBe(true);
    expect(caps.has("negate")).toBe(true);
    expect(caps.has("tint")).toBe(true);
    expect(caps.has("effect")).toBe(true);
  });

  it("does not include operations unsupported by sharp", () => {
    const adapter = new SharpAdapter();
    expect(adapter.capabilities.has("normalize")).toBe(false);
    expect(adapter.capabilities.has("affine")).toBe(false);
    expect(adapter.capabilities.has("unrecognized-op")).toBe(false);
  });

  it("is immutable across instances (shared reference)", () => {
    const a1 = new SharpAdapter();
    const a2 = new SharpAdapter();
    // Same capabilities reference (module-level constant)
    expect(a1.capabilities).toBe(a2.capabilities);
  });
});

// ---------------------------------------------------------------------------
// execute() — single operation tests
// ---------------------------------------------------------------------------

describe("SharpAdapter.execute — single operations", () => {
  // ------------------------------------------------------------------
  // Resize
  // ------------------------------------------------------------------

  it("resize — produces correctly sized output (width + height)", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Resize", width: 50, height: 50 }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("resize — width only preserves aspect ratio", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Resize", width: 50 }];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(50);
    // Height auto-scaled: 200 * (50/100) = 100
    expect(meta.height).toBe(100);
  });

  it("resize — height only preserves aspect ratio", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Resize", height: 50 }];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await metaOf(result);

    // Width auto-scaled: 100 * (50/200) = 25
    expect(meta.width).toBe(25);
    expect(meta.height).toBe(50);
  });

  it("resize — with fit option", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Resize", width: 30, height: 30, fit: "fill" },
    ];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(30);
    expect(meta.height).toBe(30);
  });

  // ------------------------------------------------------------------
  // Grayscale
  // ------------------------------------------------------------------

  it("grayscale — produces valid output with changed channels", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Grayscale" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    // Input had 4 channels (RGBA); sharp preserves alpha when
    // outputting PNG — grayscale reduces channel VALUES but
    // doesn't strip the alpha channel in PNG output.
    expect(meta.channels).toBe(4);
    expect(meta.format).toBe("png");
  });

  // ------------------------------------------------------------------
  // Format conversion
  // ------------------------------------------------------------------

  it("format — converts to JPEG", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Format", format: "jpeg" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.format).toBe("jpeg");
  });

  it("format — converts to PNG", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Format", format: "png" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.format).toBe("png");
  });

  it("format — converts to WebP", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Format", format: "webp" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.format).toBe("webp");
  });

  // ------------------------------------------------------------------
  // Crop
  // ------------------------------------------------------------------

  it("crop — extracts the specified region", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Crop", x: 10, y: 10, width: 50, height: 50 },
    ];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it("crop — from top-left corner", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Crop", x: 0, y: 0, width: 80, height: 80 },
    ];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(80);
    expect(meta.height).toBe(80);
  });

  // ------------------------------------------------------------------
  // Rotate
  // ------------------------------------------------------------------

  it("rotate 90° — swaps width and height for non-square image", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Rotate", degrees: 90 }];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await metaOf(result);

    // 100×200 rotated 90° → 200×100
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(100);
  });

  it("rotate 180° — dimensions unchanged", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Rotate", degrees: 180 }];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
  });

  // ------------------------------------------------------------------
  // Flip / Flop
  // ------------------------------------------------------------------

  it("flip — produces valid output (vertical mirror)", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Flip" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    // Dimensions unchanged by flip
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  it("flop — produces valid output (horizontal mirror)", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Flop" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    // Dimensions unchanged by flop
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  // ------------------------------------------------------------------
  // Blur
  // ------------------------------------------------------------------

  it("blur — produces valid output", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Blur", sigma: 5 }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  it("blur — with small sigma", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Blur", sigma: 0.5 }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  // ------------------------------------------------------------------
  // Sharpen
  // ------------------------------------------------------------------

  it("sharpen — produces valid output", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Sharpen" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  // ------------------------------------------------------------------
  // Negate
  // ------------------------------------------------------------------

  it("negate — produces valid output", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Negate" }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  // ------------------------------------------------------------------
  // Tint
  // ------------------------------------------------------------------

  it("tint — produces valid output with correct dimensions", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Tint", r: 128, g: 64, b: 32 }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });

  // ------------------------------------------------------------------
  // Effect — escape hatch (passed through silently by sharp adapter)
  // ------------------------------------------------------------------

  it("effect — passthrough does not alter output", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Effect", effect: (_img: unknown) => _img }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    expect(meta.format).toBe("png");
  });
});

// ---------------------------------------------------------------------------
// execute() — empty ops and multiple chained operations
// ---------------------------------------------------------------------------

describe("SharpAdapter.execute — chaining and defaults", () => {
  it("empty ops — returns valid PNG output unchanged", async () => {
    const adapter = new SharpAdapter();
    const result = await Effect.runPromise(adapter.execute(redSquare, []));
    const meta = await metaOf(result);

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
    // Defaults to PNG when no Format op is present
    expect(meta.format).toBe("png");
  });

  it("chains multiple ops — resize → grayscale → format", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Resize", width: 50, height: 50 },
      { _tag: "Grayscale" },
      { _tag: "Format", format: "jpeg" },
    ];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
    expect(meta.format).toBe("jpeg");
    expect(meta.channels).toBe(3); // grayscale → 3 channels, JPEG enforces it
  });

  it("chains multiple ops — crop → blur → rotate → format", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Crop", x: 0, y: 0, width: 50, height: 100 },
      { _tag: "Blur", sigma: 2 },
      { _tag: "Rotate", degrees: 90 },
      { _tag: "Format", format: "webp" },
    ];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await metaOf(result);

    // 50×100 rotated 90° → 100×50
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
    expect(meta.format).toBe("webp");
  });

  it("chains resize + flip + flop", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [
      { _tag: "Resize", width: 80, height: 80 },
      { _tag: "Flip" },
      { _tag: "Flop" },
    ];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.width).toBe(80);
    expect(meta.height).toBe(80);
    expect(meta.format).toBe("png");
  });

  it("output defaults to PNG when format op is absent", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Resize", width: 30, height: 30 }];

    const result = await Effect.runPromise(adapter.execute(redSquare, ops));
    const meta = await metaOf(result);

    expect(meta.format).toBe("png");
  });
});

// ---------------------------------------------------------------------------
// metadata()
// ---------------------------------------------------------------------------

describe("SharpAdapter.metadata", () => {
  it("returns width and height from a known image", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(redSquare));

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it("returns format from a known image", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(redSquare));

    expect(meta.format).toBe("png");
  });

  it("returns channel count", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(redSquare));

    // 4-channel RGBA PNG
    expect(meta.channels).toBe(4);
  });

  it("reports hasAlpha for RGBA image", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(redSquare));

    expect(meta.hasAlpha).toBe(true);
  });

  it("reports hasAlpha as false for RGB-only image", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(blueRect));

    expect(meta.hasAlpha).toBe(false);
  });

  it("returns correct dimensions for rectangular image", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(blueRect));

    expect(meta.width).toBe(100);
    expect(meta.height).toBe(200);
  });

  it("returns space information", async () => {
    const adapter = new SharpAdapter();
    const meta = await Effect.runPromise(adapter.metadata(redSquare));

    expect(meta.space).toBe("srgb");
  });

  it("returns correct metadata after a resize operation", async () => {
    const adapter = new SharpAdapter();
    const ops: ImageOp[] = [{ _tag: "Resize", width: 30, height: 60 }];

    const result = await Effect.runPromise(adapter.execute(blueRect, ops));
    const meta = await Effect.runPromise(adapter.metadata(result));

    expect(meta.width).toBe(30);
    expect(meta.height).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("SharpAdapter — error handling", () => {
  it("execute with invalid input returns ImageAdapterError", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from("this is not a valid image");

    const exit = await Effect.runPromiseExit(adapter.execute(corrupt, []));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause._tag).toBe("Fail");
      if (exit.cause._tag === "Fail") {
        expect(exit.cause.error._tag).toBe("ImageAdapterError");
      }
    }
  });

  it("execute with corrupt input — error contains _tag", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from([0x00, 0x01, 0x02, 0x03]);

    const exit = await Effect.runPromiseExit(adapter.execute(corrupt, []));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      const err = exit.cause.error;
      expect(err._tag).toBe("ImageAdapterError");
      expect(err.message).toBeTruthy();
      expect(err.cause).toBeTruthy();
    }
  });

  it("execute with corrupt input — message describes the failure", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from("not-an-image-bytes");

    await expect(
      Effect.runPromise(adapter.execute(corrupt, [])),
    ).rejects.toHaveProperty("message");
  });

  it("metadata with invalid input returns ImageAdapterError", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from("garbage data");

    const exit = await Effect.runPromiseExit(adapter.metadata(corrupt));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error._tag).toBe("ImageAdapterError");
    }
  });

  it("metadata with invalid input — error contains _tag", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from([0xff, 0xff, 0xff]);

    const exit = await Effect.runPromiseExit(adapter.metadata(corrupt));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      const err = exit.cause.error;
      expect(err._tag).toBe("ImageAdapterError");
      expect(err.message).toBeTruthy();
    }
  });

  it("execute returns an Effect that can be caught with Effect.catchTag", async () => {
    const adapter = new SharpAdapter();
    const corrupt = Buffer.from("not valid");

    const program = adapter.execute(corrupt, []).pipe(
      Effect.catchTag("ImageAdapterError", (err) =>
        Effect.succeed(`caught: ${err.message}`),
      ),
    );

    const result = await Effect.runPromise(program);
    expect(result).toContain("caught:");
  });
});

// ---------------------------------------------------------------------------
// Effect Layer integration (via @effect/vitest it.layer)
// ---------------------------------------------------------------------------

effectIt.layer(Sharp.layer)("Sharp.layer integration", (it) => {
  it.scoped("provides ImageAdapter via Sharp.layer", () =>
    Effect.gen(function* () {
      const adapter = yield* ImageAdapter;

      expect(adapter).toBeDefined();
      expect(adapter.capabilities.has("resize")).toBe(true);
      expect(typeof adapter.execute).toBe("function");
      expect(typeof adapter.metadata).toBe("function");
    }),
  );

  it.scoped("can execute an operation through the layer", () =>
    Effect.gen(function* () {
      const adapter = yield* ImageAdapter;
      const ops: ImageOp[] = [{ _tag: "Resize", width: 50, height: 50 }];

      const result = yield* adapter.execute(redSquare, ops);
      const meta = yield* Effect.tryPromise(() => sharp(result).metadata());

      expect(meta.width).toBe(50);
      expect(meta.height).toBe(50);
    }),
  );

  it.scoped("can extract metadata through the layer", () =>
    Effect.gen(function* () {
      const adapter = yield* ImageAdapter;
      const meta = yield* adapter.metadata(redSquare);

      expect(meta.width).toBe(100);
      expect(meta.height).toBe(100);
      expect(meta.format).toBe("png");
    }),
  );

  it.scoped("metadata reports channels through the layer", () =>
    Effect.gen(function* () {
      const adapter = yield* ImageAdapter;
      const meta = yield* adapter.metadata(redSquare);

      expect(meta.channels).toBe(4);
      expect(meta.hasAlpha).toBe(true);
    }),
  );
});

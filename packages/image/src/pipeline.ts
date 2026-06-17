/**
 * @module @effect-pantry/image/pipeline
 *
 * The {@link ImagePipeline} — a fluent, chainable builder that collects
 * image-processing operations as a pure Op ADT and executes them all at
 * once through an {@link ImageAdapterInterface}.
 *
 * Operations are validated eagerly against the adapter's
 * {@link ImageAdapterInterface.capabilities | capabilities} at chain
 * time (fail-fast).  Terminal methods (`toBuffer`, `toFile`, `toStream`)
 * return an {@link Effect.Effect} that applies the full operation chain
 * in a single adapter execution.
 *
 * @example
 * ```ts
 * import { ImagePipeline, ImageAdapter } from "@effect-pantry/image";
 *
 * const pipeline = new ImagePipeline(myAdapter, inputBuffer)
 *   .resize(200, 200, { fit: "cover" })
 *   .grayscale()
 *   .convert("webp");
 *
 * // Terminal — returns Effect
 * const result = await Effect.runPromise(pipeline.toBuffer());
 * ```
 */

import { Effect, Stream, pipe } from "effect";
import { writeFile } from "node:fs/promises";
import type { ImageAdapterInterface } from "./adapter.js";
import { toImageError, UnsupportedOpError } from "./errors.js";
import type { ImageError } from "./errors.js";
import type { Fit, ImageFormat, ImageOp } from "./types.js";

// ---------------------------------------------------------------------------
// OutputInfo
// ---------------------------------------------------------------------------

/**
 * Result returned by {@link ImagePipeline.toFile} after writing the
 * processed image buffer to disk.
 */
export interface OutputInfo {
  /** Absolute or relative file-system path the image was written to. */
  readonly path: string;
  /** Size of the written file in bytes. */
  readonly size: number;
}

// ---------------------------------------------------------------------------
// Op tag → adapter capability name mapping
// ---------------------------------------------------------------------------

const tagToCapability: Record<string, string> = {
  Resize: "resize",
  Grayscale: "grayscale",
  Format: "format",
  Crop: "crop",
  Rotate: "rotate",
  Flip: "flip",
  Flop: "flop",
  Blur: "blur",
  Sharpen: "sharpen",
  Negate: "negate",
  Tint: "tint",
  Effect: "effect",
};

// ---------------------------------------------------------------------------
// Capability check helper
// ---------------------------------------------------------------------------

/**
 * Throw {@link UnsupportedOpError} immediately if the adapter does not
 * declare support for the given operation name.
 *
 * This is the fail-fast mechanism — validation happens at pipeline-build
 * time, not at execution time.
 *
 * @internal
 */
const checkCapability = (
  capabilities: ReadonlySet<string>,
  op: string,
): void => {
  if (!capabilities.has(op)) {
    throw new UnsupportedOpError({
      message: `Operation "${op}" is not supported by this adapter`,
      op,
    });
  }
};

// ---------------------------------------------------------------------------
// ImagePipeline
// ---------------------------------------------------------------------------

/**
 * Fluent image-processing pipeline.
 *
 * Collects {@link ImageOp} variants via chainable mutating methods and
 * applies them in a single batch through the adapter's
 * {@link ImageAdapterInterface.execute} method.  Every operation is
 * validated against the adapter's `capabilities` set at call time
 * (fail-fast), and again via {@link validate} before execution.
 *
 * Terminal methods return an {@link Effect.Effect} — the pipeline itself
 * is pure data until a terminal method is called.
 */
export class ImagePipeline {
  private readonly operations: ImageOp[] = [];

  constructor(
    private readonly adapter: ImageAdapterInterface,
    private readonly input: Buffer,
  ) {}

  // -----------------------------------------------------------------------
  // Lazy mutating methods (return `this` for chaining)
  // -----------------------------------------------------------------------

  /**
   * Resize the image to target dimensions with an optional fit strategy.
   *
   * Requires adapter capability `"resize"`.
   */
  resize(width: number, height: number, opts?: { readonly fit?: Fit }): this {
    checkCapability(this.adapter.capabilities, "resize");
    this.operations.push({
      _tag: "Resize",
      width,
      height,
      ...(opts?.fit !== undefined ? { fit: opts.fit } : {}),
    });
    return this;
  }

  /**
   * Convert the image to greyscale (black and white).
   *
   * Requires adapter capability `"grayscale"`.
   */
  grayscale(): this {
    checkCapability(this.adapter.capabilities, "grayscale");
    this.operations.push({ _tag: "Grayscale" });
    return this;
  }

  /**
   * Convert the image to the given output format.
   *
   * Requires adapter capability `"format"`.
   */
  convert(format: ImageFormat): this {
    checkCapability(this.adapter.capabilities, "format");
    this.operations.push({ _tag: "Format", format });
    return this;
  }

  /**
   * Crop a rectangular region from the image.
   *
   * Coordinates are 0-based, measured from the top-left corner.
   * Requires adapter capability `"crop"`.
   */
  crop(x: number, y: number, width: number, height: number): this {
    checkCapability(this.adapter.capabilities, "crop");
    this.operations.push({ _tag: "Crop", x, y, width, height });
    return this;
  }

  /**
   * Rotate the image by the given angle in degrees (positive = clockwise).
   *
   * Requires adapter capability `"rotate"`.
   */
  rotate(degrees: number): this {
    checkCapability(this.adapter.capabilities, "rotate");
    this.operations.push({ _tag: "Rotate", degrees });
    return this;
  }

  /**
   * Flip the image vertically (about the x-axis).
   *
   * Requires adapter capability `"flip"`.
   */
  flip(): this {
    checkCapability(this.adapter.capabilities, "flip");
    this.operations.push({ _tag: "Flip" });
    return this;
  }

  /**
   * Flop the image horizontally (about the y-axis).
   *
   * Requires adapter capability `"flop"`.
   */
  flop(): this {
    checkCapability(this.adapter.capabilities, "flop");
    this.operations.push({ _tag: "Flop" });
    return this;
  }

  /**
   * Apply a Gaussian blur with the given sigma (>= 0.3).
   *
   * Requires adapter capability `"blur"`.
   */
  blur(sigma: number): this {
    checkCapability(this.adapter.capabilities, "blur");
    this.operations.push({ _tag: "Blur", sigma });
    return this;
  }

  /**
   * Sharpen the image.
   *
   * Requires adapter capability `"sharpen"`.
   */
  sharpen(): this {
    checkCapability(this.adapter.capabilities, "sharpen");
    this.operations.push({ _tag: "Sharpen" });
    return this;
  }

  /**
   * Negate the image colours (produce a negative).
   *
   * Requires adapter capability `"negate"`.
   */
  negate(): this {
    checkCapability(this.adapter.capabilities, "negate");
    this.operations.push({ _tag: "Negate" });
    return this;
  }

  /**
   * Tint the image by clamping RGB channel multipliers (0–255).
   *
   * Requires adapter capability `"tint"`.
   */
  tint(r: number, g: number, b: number): this {
    checkCapability(this.adapter.capabilities, "tint");
    this.operations.push({ _tag: "Tint", r, g, b });
    return this;
  }

  /**
   * Escape-hatch for custom mid-pipeline effectful operations.
   *
   * The supplied function receives the current image representation
   * and returns a transformed one.  Adapter implementations apply this
   * inline during pipeline execution.
   *
   * Requires adapter capability `"effect"`.
   */
  effect(fn: (img: any) => any): this {
    checkCapability(this.adapter.capabilities, "effect");
    this.operations.push({ _tag: "Effect", effect: fn });
    return this;
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate that every accumulated operation is supported by the
   * adapter's {@link ImageAdapterInterface.capabilities | capabilities}.
   *
   * Throws {@link UnsupportedOpError} immediately on the first
   * unsupported operation.  Called automatically by every terminal
   * method before execution.
   *
   * @throws {UnsupportedOpError} When any accumulated op is not in the
   *   adapter's capabilities set.
   */
  validate(): void {
    const { capabilities } = this.adapter;
    for (const op of this.operations) {
      const capability = tagToCapability[op._tag];
      if (capability && !capabilities.has(capability)) {
        throw new UnsupportedOpError({
          message: `Operation "${op._tag}" is not supported by this adapter`,
          op: capability,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Terminal methods (return Effect)
  // -----------------------------------------------------------------------

  /**
   * Execute all accumulated operations and return the result as a
   * {@link Buffer}.
   *
   * Calls {@link validate} before delegating to
   * {@link ImageAdapterInterface.execute}.
   */
  toBuffer(): Effect.Effect<Buffer, ImageError> {
    this.validate();
    return this.adapter.execute(this.input, this.operations);
  }

  /**
   * Execute all accumulated operations and write the resulting image
   * buffer to the given file-system path.
   *
   * Calls {@link validate} before execution.  Returns an
   * {@link OutputInfo} record containing the path and written byte
   * count.
   */
  toFile(path: string): Effect.Effect<OutputInfo, ImageError> {
    this.validate();
    const { adapter, input, operations } = this;
    return Effect.gen(function* () {
      const buffer = yield* adapter.execute(input, operations);
      yield* Effect.tryPromise({
        try: () => writeFile(path, buffer),
        catch: toImageError,
      });
      return { path, size: buffer.length } satisfies OutputInfo;
    });
  }

  /**
   * Execute all accumulated operations and stream the resulting image
   * as a {@link Uint8Array} stream.
   *
   * Calls {@link validate} before execution.  The returned stream
   * emits a single chunk containing the full-processed image bytes.
   */
  toStream(): Stream.Stream<Uint8Array, ImageError> {
    this.validate();
    const { adapter, input, operations } = this;
    return pipe(
      Stream.fromEffect(adapter.execute(input, operations)),
      Stream.map((buf) => new Uint8Array(buf)),
    );
  }
}

/**
 * @module @effect-pantry/image-sharp/adapter
 *
 * Sharp-based {@link @effect-pantry/image!ImageAdapterInterface} implementation.
 * Translates {@link @effect-pantry/image!ImageOp} discriminated union to sharp's
 * pipeline API, enabling native batch-optimised image processing.
 *
 * @example
 * ```ts
 * import { SharpAdapter } from "@effect-pantry/image-sharp";
 *
 * const adapter = new SharpAdapter();
 * adapter.capabilities.has("resize"); // true
 * ```
 */

import { Effect, Layer } from "effect";
import sharp from "sharp";
import type {
  ImageAdapterInterface,
  ImageOp,
  ImageMetadata,
  ImageError,
} from "@effect-pantry/image";
import { ImageAdapter, ImageAdapterError } from "@effect-pantry/image";

// ---------------------------------------------------------------------------
// Capabilities — fixed set of sharp-supported operations
// ---------------------------------------------------------------------------

/**
 * Operations natively supported by the sharp pipeline.
 * Includes the `"effect"` escape hatch for user-defined mid-pipeline effects,
 * though sharp-based adapters cannot execute effect functions inline —
 * they are silently passed through.
 */
const CAPABILITIES: ReadonlySet<string> = new Set([
  "resize",
  "grayscale",
  "format",
  "crop",
  "rotate",
  "flip",
  "flop",
  "blur",
  "sharpen",
  "negate",
  "tint",
  "effect",
]);

// ---------------------------------------------------------------------------
// Format map — lookup for sharp output-format methods
// ---------------------------------------------------------------------------

const formatMap = {
  jpeg: (s: sharp.Sharp) => s.jpeg(),
  png: (s: sharp.Sharp) => s.png(),
  webp: (s: sharp.Sharp) => s.webp(),
  avif: (s: sharp.Sharp) => s.avif(),
  gif: (s: sharp.Sharp) => s.gif(),
  tiff: (s: sharp.Sharp) => s.tiff(),
} as const;

/** Map an {@link @effect-pantry/image!ImageFormat} string to the corresponding
 * sharp output method. Unsupported formats are silently skipped (the pipeline
 * will fall back to PNG if no format was set). */
const formatMethod = (format: string): keyof typeof formatMap | null =>
  format in formatMap ? (format as keyof typeof formatMap) : null;

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/**
 * Wrap an unknown error into an {@link ImageAdapterError} so that every
 * sharp failure surfaces as a typed {@link ImageError}.
 */
const toAdapterError = (error: unknown): ImageAdapterError =>
  new ImageAdapterError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });

// ---------------------------------------------------------------------------
// SharpAdapter
// ---------------------------------------------------------------------------

/**
 * Sharp-backed image processing adapter.
 *
 * Implements {@link ImageAdapterInterface} by translating
 * {@link ImageOp} discriminated union values to sharp's chainable pipeline
 * API.  All operations are accumulated into a single sharp instance and
 * executed once via `.toBuffer()` — no per-op round-trips.
 *
 * Use {@link Sharp.layer} to provide this adapter into the Effect
 * dependency graph:
 *
 * ```ts
 * import { Sharp } from "@effect-pantry/image-sharp";
 * import { Effect } from "effect";
 *
 * Effect.provide(program, Sharp.layer);
 * ```
 */
export class SharpAdapter implements ImageAdapterInterface {
  /** Operations this adapter supports (all sharp-native operations). */
  readonly capabilities: ReadonlySet<string> = CAPABILITIES;

  /**
   * Execute a chain of image operations against the input buffer.
   *
   * Builds a sharp pipeline from the {@link ImageOp} list, setting the
   * output format to PNG when no explicit `Format` op is present, and
   * renders the result via `sharp().toBuffer()`.
   */
  execute(
    input: Buffer,
    ops: ReadonlyArray<ImageOp>,
  ): Effect.Effect<Buffer, ImageError> {
    return Effect.tryPromise({
      try: () => {
        let pipeline = sharp(input);
        let formatSet = false;

        for (const op of ops) {
          switch (op._tag) {
            case "Resize":
              pipeline = pipeline.resize({
                ...(op.width !== undefined ? { width: op.width } : {}),
                ...(op.height !== undefined ? { height: op.height } : {}),
                ...(op.fit !== undefined ? { fit: op.fit } : {}),
              });
              break;

            case "Grayscale":
              pipeline = pipeline.grayscale();
              break;

            case "Format": {
              const method = formatMethod(op.format);
              if (method !== null) {
                // Non-null assertion safe: method is verified in-bounds above
                pipeline = formatMap[method]!(pipeline);
                formatSet = true;
              }
              break;
            }

            case "Crop":
              pipeline = pipeline.extract({
                left: op.x,
                top: op.y,
                width: op.width,
                height: op.height,
              });
              break;

            case "Rotate":
              pipeline = pipeline.rotate(op.degrees);
              break;

            case "Flip":
              pipeline = pipeline.flip();
              break;

            case "Flop":
              pipeline = pipeline.flop();
              break;

            case "Blur":
              pipeline = pipeline.blur(op.sigma);
              break;

            case "Sharpen":
              pipeline = pipeline.sharpen();
              break;

            case "Negate":
              pipeline = pipeline.negate();
              break;

            case "Tint":
              pipeline = pipeline.tint({ r: op.r, g: op.g, b: op.b });
              break;

            // Effect: escape hatch for user-defined mid-pipeline effects.
            // Sharp-based adapters cannot execute them inline — they are
            // silently passed through.  The upstream pipeline validates
            // capabilities before execution, so only declared-effect ops
            // reach this point.
            case "Effect":
              break;
          }
        }

        // Default to PNG output when no Format op was specified
        if (!formatSet) {
          pipeline = pipeline.png();
        }

        return pipeline.toBuffer();
      },
      catch: toAdapterError,
    });
  }

  /**
   * Extract image metadata without performing any transformations.
   *
   * Delegates directly to `sharp(input).metadata()`, which reads only
   * the image header — no pixel decoding occurs.
   */
  metadata(input: Buffer): Effect.Effect<ImageMetadata, ImageError> {
    return Effect.tryPromise({
      try: () => sharp(input).metadata() as unknown as Promise<ImageMetadata>,
      catch: toAdapterError,
    });
  }
}

// ---------------------------------------------------------------------------
// Layer
// ---------------------------------------------------------------------------

/**
 * The `Sharp` module — provides the sharp-based {@link ImageAdapter}
 * implementation via an Effect {@link Layer}.
 *
 * @example
 * ```ts
 * import { Sharp } from "@effect-pantry/image-sharp";
 * import { Effect } from "effect";
 *
 * Effect.provide(myProgram, Sharp.layer);
 * ```
 */
export namespace Sharp {
  /**
   * Construct a layer that provides {@link ImageAdapter} backed by sharp.
   *
   * Uses {@link Layer.succeed} since `SharpAdapter` is stateless — no
   * scoped resource acquisition is required.
   */
  export const layer = Layer.succeed(ImageAdapter, new SharpAdapter());
}

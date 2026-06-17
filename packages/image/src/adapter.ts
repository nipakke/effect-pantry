/**
 * @module @effect-pantry/image/adapter
 *
 * The {@link ImageAdapter} {@link Context.Tag} — the pluggable service
 * interface that every image processing backend must implement.
 *
 * Provide via `Layer.succeed(ImageAdapter, myAdapter)` to plug any image
 * processing library (Sharp, jimp, canvas, etc.) into the {@link Image}
 * service pipeline.
 */

import { Context, Effect } from "effect";
import type { ImageFormat, ImageMetadata, ImageOp } from "./types.js";
import type { ImageError } from "./errors.js";

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * The interface every image processing adapter must implement.
 *
 * Adapters receive the complete list of image operations at execution time,
 * enabling native batch optimisation (e.g. sharp applies all transforms in a
 * single pipeline chain instead of one-at-a-time round-trips).
 *
 * @example
 * ```ts
 * import { ImageAdapter } from "@effect-pantry/image";
 * import { Layer } from "effect";
 *
 * const layer = Layer.succeed(ImageAdapter, {
 *   capabilities: new Set(["resize", "format"]),
 *   execute: (buf, ops) => Effect.succeed(buf),
 *   metadata: (buf) => Effect.succeed({}),
 * });
 * ```
 */
export interface ImageAdapterInterface {
  /** Which image operations this adapter supports (e.g. `"resize"`, `"blur"`). */
  readonly capabilities: ReadonlySet<string>;

  /**
   * Apply a chain of image operations to the input buffer and return the
   * resulting image as a Buffer.
   */
  readonly execute: (
    input: Buffer,
    ops: ReadonlyArray<ImageOp>,
  ) => Effect.Effect<Buffer, ImageError>;

  /**
   * Extract metadata (format, dimensions, colour space, EXIF, ICC, etc.) from
   * the input buffer without performing any image transformations.
   */
  readonly metadata: (
    input: Buffer,
  ) => Effect.Effect<ImageMetadata, ImageError>;
}

// ---------------------------------------------------------------------------
// Context.Tag
// ---------------------------------------------------------------------------

/**
 * The `ImageAdapter` {@link Context.Tag} — provides the pluggable image
 * processing backend used by the {@link Image} service.
 *
 * Provide via `Layer.succeed(ImageAdapter, myAdapter)` to plug any
 * image processing library (Sharp, jimp, canvas, etc.) into the pipeline.
 * Consumers resolve it with `yield* ImageAdapter`.
 *
 * The tag's service type is {@link ImageAdapterInterface}. When annotating
 * function parameters that receive the adapter, use
 * `Context.Tag.Service<typeof ImageAdapter>` rather than the tag class
 * itself.
 */
export class ImageAdapter extends Context.Tag("@effect-pantry/image/ImageAdapter")<
  ImageAdapter,
  ImageAdapterInterface
>() {}

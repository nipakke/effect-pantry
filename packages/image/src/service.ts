/**
 * @module @effect-pantry/image/service
 *
 * The {@link Image} {@link Context.Tag} — the Effect-native image service
 * providing entry points for creating image processing pipelines.
 *
 * Depends on {@link ImageAdapter} from the Effect context.  Every method
 * creates {@link ImagePipeline} instances that lazily collect operations
 * and execute them through the adapter.
 *
 * Provide via {@link layer}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect";
 * import { Image } from "@effect-pantry/image";
 *
 * const program = Effect.gen(function* () {
 *   const image = yield* Image;
 *   const pipeline = image.fromBuffer(buffer)
 *     .resize(200, 200, { fit: "cover" })
 *     .grayscale()
 *     .convert("webp");
 *   return yield* pipeline.toBuffer();
 * });
 * ```
 */

import { Context, Effect, Layer, pipe } from "effect";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { ImageAdapter } from "./adapter.js";
import { toImageError } from "./errors.js";
import type { ImageError } from "./errors.js";
import { ImagePipeline } from "./pipeline.js";
import type { ImageMetadata } from "./types.js";

// ---------------------------------------------------------------------------
// ImageInterface
// ---------------------------------------------------------------------------

/**
 * The public interface provided by the {@link Image} service.
 *
 * Entry points for creating {@link ImagePipeline} instances from various
 * input sources.  The underlying image-processing backend is resolved
 * through the {@link ImageAdapter} Context.Tag.
 */
export interface ImageInterface {
  /**
   * Create an {@link ImagePipeline} directly from a Buffer.
   *
   * This is the fastest entry point — no I/O required.  The pipeline
   * is ready for chaining operations immediately.
   *
   * @param buf - Raw image bytes to process.
   */
  readonly fromBuffer: (buf: Buffer) => ImagePipeline;

  /**
   * Read an image file from disk and create an {@link ImagePipeline}.
   *
   * Returns an {@link Effect} that reads the file into a Buffer and
   * wraps it in a pipeline.  Errors during file I/O are converted to
   * typed {@link ImageError} values.
   *
   * @param path - File-system path to the source image.
   */
  readonly fromFile: (path: string) => Effect.Effect<ImagePipeline, ImageError>;

  /**
   * Collect a Web {@link ReadableStream} into a Buffer and create an
   * {@link ImagePipeline}.
   *
   * Uses Node.js
   * {@link https://nodejs.org/api/stream.html#streamreadablefromwebreadablestream-options | Readable.fromWeb}
   * to bridge the Web Streams API to Node.js streams, collecting all
   * chunks before wrapping them in a pipeline.
   *
   * @param stream - A Web-standard `ReadableStream` of image bytes.
   */
  readonly fromStream: (stream: ReadableStream) => Effect.Effect<ImagePipeline, ImageError>;

  /**
   * Convenience method to extract image metadata without creating a
   * full pipeline.
   *
   * Delegates directly to {@link ImageAdapterInterface.metadata}.
   *
   * @param buf - Raw image bytes to inspect.
   */
  readonly metadata: (buf: Buffer) => Effect.Effect<ImageMetadata, ImageError>;
}

// ---------------------------------------------------------------------------
// Image — Context.Tag
// ---------------------------------------------------------------------------

/**
 * The `Image` {@link Context.Tag} — provides the {@link ImageInterface}
 * for creating and executing image processing pipelines.
 *
 * Resolve with `yield* Image` inside an {@link Effect.Effect} program.
 * Provide via {@link layer}.
 *
 * The tag's service type is {@link ImageInterface}.  When annotating
 * function parameters that receive the service, use
 * `Context.Tag.Service<typeof Image>` rather than the tag class itself.
 */
export class Image extends Context.Tag("@effect-pantry/image/Image")<
  Image,
  ImageInterface
>() {}

// ---------------------------------------------------------------------------
// make — factory
// ---------------------------------------------------------------------------

/**
 * Create an {@link Image} service from the {@link ImageAdapter} found in
 * the Effect context.
 *
 * Yields the adapter from context and wraps it in a service object that
 * satisfies {@link ImageInterface}.  Every entry point delegates pipeline
 * creation to an adapter-holding {@link ImagePipeline} constructor.
 *
 * @example
 * ```ts
 * const svc = yield* make();
 * ```
 */
export const make = () =>
  Effect.gen(function* () {
    const adapter = yield* ImageAdapter;

    const svc: ImageInterface = {
      fromBuffer: (buf) => new ImagePipeline(adapter, buf),

      fromFile: (path) =>
        pipe(
          Effect.tryPromise({
            try: () => readFile(path),
            catch: toImageError,
          }),
          Effect.map((buf) => new ImagePipeline(adapter, buf)),
        ),

      fromStream: (stream) =>
        pipe(
          Effect.tryPromise({
            try: async () => {
              const readable = Readable.fromWeb(stream);
              const chunks: Buffer[] = [];
              for await (const chunk of readable) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            },
            catch: toImageError,
          }),
          Effect.map((buf) => new ImagePipeline(adapter, buf)),
        ),

      metadata: (buf) => adapter.metadata(buf),
    };

    return Image.of(svc);
  });

// ---------------------------------------------------------------------------
// layer
// ---------------------------------------------------------------------------

/**
 * Create an {@link Effect.Layer} that requires {@link ImageAdapter} and
 * provides {@link Image}.  The consumer supplies the adapter layer.
 *
 * @example
 * ```ts
 * import { Image, ImageAdapter } from "@effect-pantry/image";
 * import { Layer } from "effect";
 *
 * const layer = Image.layer().pipe(
 *   Layer.provide(Layer.succeed(ImageAdapter, myAdapter)),
 * );
 * ```
 */
export const layer = () => Layer.effect(Image, make());

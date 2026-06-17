/**
 * @effect-pantry/image — Effect-native image processing with pluggable backends.
 *
 * Provides a {@link Image} context tag for creating and executing image
 * processing pipelines backed by any {@link ImageAdapter} implementation
 * (Sharp, jimp, canvas, etc.).  Operations are described as a pure
 * {@link ImageOp} ADT and validated eagerly against adapter capabilities
 * (fail-fast).  Terminal methods return {@link Effect.Effect}.
 *
 * **Zero image-processing dependencies** — this package defines the
 * interface; provide an adapter to enable actual processing.
 *
 * @module
 */

export { Image, make, layer } from "./service.js";
export { ImageAdapter } from "./adapter.js";
export type { ImageAdapterInterface } from "./adapter.js";
export { ImagePipeline } from "./pipeline.js";

export {
  ImageFormatError,
  ImageDecodeError,
  ImageEncodeError,
  ImageTransformError,
  ImageAdapterError,
  UnsupportedOpError,
  toImageError,
} from "./errors.js";
export type { ImageError } from "./errors.js";

export type {
  ImageFormat,
  Dimensions,
  Fit,
  ImageMetadata,
  ImageInput,
  ImageOp,
  ResizeOpts,
  CropOpts,
} from "./types.js";

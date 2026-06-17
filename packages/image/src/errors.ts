import { Data } from 'effect';

/**
 * The requested image format is not supported by the adapter.
 *
 * @param cause - The original underlying error from the image processor.
 */
export class ImageFormatError extends Data.TaggedError('ImageFormatError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * The input image data could not be decoded (corrupt or invalid format).
 *
 * @param cause - The original underlying error from the image processor.
 */
export class ImageDecodeError extends Data.TaggedError('ImageDecodeError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * Encoding the processed image to the requested output format failed.
 *
 * @param cause - The original underlying error from the image processor.
 */
export class ImageEncodeError extends Data.TaggedError('ImageEncodeError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * An image transformation operation failed during processing.
 *
 * @param cause - The original underlying error from the image processor.
 */
export class ImageTransformError extends Data.TaggedError('ImageTransformError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * A generic adapter-level error (network, I/O, internal failure, etc.).
 *
 * @param cause - The original underlying error from the image processor.
 */
export class ImageAdapterError extends Data.TaggedError('ImageAdapterError')<{
  readonly message: string;
  readonly cause: unknown;
}> {}

/**
 * The requested operation is not supported by the current image adapter.
 *
 * @param op - The name of the unsupported operation.
 */
export class UnsupportedOpError extends Data.TaggedError('UnsupportedOpError')<{
  readonly message: string;
  readonly op: string;
}> {}

export type ImageError =
  | ImageFormatError
  | ImageDecodeError
  | ImageEncodeError
  | ImageTransformError
  | ImageAdapterError
  | UnsupportedOpError;

/**
 * Convert an unknown error to a typed {@link ImageError}.
 *
 * If the error is already an instance of an ImageError, it is returned
 * unchanged. All other errors are wrapped in an {@link ImageAdapterError}.
 */
export const toImageError = (error: unknown): ImageError => {
  if (
    error instanceof ImageFormatError ||
    error instanceof ImageDecodeError ||
    error instanceof ImageEncodeError ||
    error instanceof ImageTransformError ||
    error instanceof ImageAdapterError ||
    error instanceof UnsupportedOpError
  ) {
    return error;
  }
  return new ImageAdapterError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
};

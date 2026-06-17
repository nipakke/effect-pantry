/**
 * @module @effect-pantry/image/types
 *
 * Pure type definitions for the image processing module.
 * Zero runtime dependencies — type-only exports.
 *
 * These types are consumed by {@link ImagePipeline}, {@link ImageAdapter},
 * and all adapter implementations (e.g. sharp).
 */

// ---------------------------------------------------------------------------
// Format & dimension types
// ---------------------------------------------------------------------------

/**
 * Supported image output formats.
 *
 * Mirrors the encodings available in sharp and most image-processing
 * back-ends.  Not every adapter supports every format — check
 * {@link ImageAdapter.capabilities} before requesting a conversion.
 */
export type ImageFormat =
  | "jpeg"
  | "png"
  | "webp"
  | "avif"
  | "gif"
  | "tiff"
  | "heif"
  | "raw";

/**
 * Pixel dimensions of an image.
 *
 * Both values are positive integers (sharp convention: `width` and
 * `height` are `number` for compatibility with EXIF orientation
 * adjustments, but in practice they are whole numbers).
 */
export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * Resize fit strategy — controls how an image is scaled to fit within
 * or fill a target bounding box.
 *
 * | Strategy   | Behaviour                                                      |
 * | ---------- | -------------------------------------------------------------- |
 * | `cover`    | Crop to cover both dimensions (CSS `object-fit: cover`).       |
 * | `contain`  | Embed within dimensions, leaving letterboxing (CSS `contain`). |
 * | `fill`     | Stretch to exact dimensions ignoring aspect ratio.             |
 * | `inside`   | Scale down to fit wholly *inside* dimensions (never upscale).  |
 * | `outside`  | Scale up to *just cover* dimensions (never downscale).         |
 */
export type Fit = "cover" | "contain" | "fill" | "inside" | "outside";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Extracted image metadata.
 *
 * Mirrors the shape returned by `sharp(input).metadata()`.  All fields
 * are optional because the availability depends on the source format
 * and the back-end implementation.
 *
 * @remarks
 * Field semantics match the sharp reference exactly:
 * - `orientation` — EXIF orientation tag (1-8).
 * - `density` — DPI value derived from embedded resolution info.
 * - `channels` — number of colour channels (e.g. 3 for RGB, 4 for CMYK).
 * - `hasAlpha` — whether an alpha channel is present.
 * - `space` — colour-space identifier (e.g. `"srgb"`, `"cmyk"`).
 * - `depth` — bit-depth per channel (e.g. 8, 16).
 */
export interface ImageMetadata {
  /** File / mime format detected (e.g. `"jpeg"`, `"png"`). */
  readonly format?: string;
  /** Pixel width of the image. */
  readonly width?: number;
  /** Pixel height of the image. */
  readonly height?: number;
  /** File size in bytes (when available from the input source). */
  readonly size?: number;
  /** Number of colour channels (3 = RGB, 4 = CMYK). */
  readonly channels?: number;
  /** Whether the image contains an alpha (transparency) channel. */
  readonly hasAlpha?: boolean;
  /** EXIF orientation tag (1-8). */
  readonly orientation?: number;
  /** Pixel density (DPI) derived from embedded resolution metadata. */
  readonly density?: number;
  /** Colour-space string (e.g. `"srgb"`, `"cmyk"`, `"b-w"`). */
  readonly space?: string;
  /** Bit-depth per colour channel (e.g. 8, 16). */
  readonly depth?: string;
  /** Whether the image has an embedded ICC colour profile. */
  readonly hasProfile?: boolean;
  /** Number of pages/frames (multi-page TIFF, animated GIF, etc.). */
  readonly pages?: number;
  /** Height of each page when pages > 1. */
  readonly pageHeight?: number;
  /** Index of the primary page (sharp >= 0.33). */
  readonly pagePrimary?: number;
  /** Histogram levels (sharp >= 0.33). */
  readonly levels?: ReadonlyArray<{ readonly r: number; readonly g: number; readonly b: number }>;
  /** JPEG chroma sub-sampling string (e.g. `"4:2:0"`). */
  readonly chromaSubsampling?: string;
  /** Whether the JPEG image uses progressive encoding. */
  readonly isProgressive?: boolean;
  /** GIF / animated WebP frame delay in milliseconds. */
  readonly delay?: ReadonlyArray<number>;
  /** GIF repetition count (0 = infinite). */
  readonly loop?: number;
  /** Suggested background colour for transparent regions (sharp >= 0.33). */
  readonly background?: { readonly r: number; readonly g: number; readonly b: number };
  /** Dominant colour (sharp >= 0.33 stats). */
  readonly dominant?: { readonly r: number; readonly g: number; readonly b: number };
  /** Resolution unit string (e.g. `"inch"`, `"cm"`). */
  readonly resolutionUnit?: string;
  /** XMP XML metadata block embedded in the image. */
  readonly xmp?: string;
  /** Raw EXIF buffer. */
  readonly exif?: Buffer;
  /** Raw ICC profile buffer. */
  readonly icc?: Buffer;
  /** Raw IPTC buffer. */
  readonly iptc?: Buffer;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Supported image input types.
 *
 * Anything that can be passed to an image-processing pipeline:
 * - `Buffer` — raw byte buffer (most common).
 * - `Uint8Array` — typed array of image bytes.
 * - `string` — file-system path to the source image.
 */
export type ImageInput = Buffer | Uint8Array | string;

// ---------------------------------------------------------------------------
// Operation option types
// ---------------------------------------------------------------------------

/**
 * Options for the {@link ImageOp.Resize | Resize} operation.
 *
 * All fields are optional — omitting both `width` and `height` means
 * the original dimensions are preserved (useful for fit-only
 * operations like `fit: "inside"` on oversized images).
 */
export interface ResizeOpts {
  /** Target width in pixels. */
  readonly width?: number;
  /** Target height in pixels. */
  readonly height?: number;
  /** Fit strategy (see {@link Fit}). */
  readonly fit?: Fit;
}

/**
 * Options for the {@link ImageOp.Crop | Crop} operation.
 *
 * Extracts a rectangular region from the image. All coordinates are
 * 0-based and measured from the top-left corner.
 */
export interface CropOpts {
  /** Left edge pixel coordinate. */
  readonly x: number;
  /** Top edge pixel coordinate. */
  readonly y: number;
  /** Width of the cropped region in pixels. */
  readonly width: number;
  /** Height of the cropped region in pixels. */
  readonly height: number;
}

// ---------------------------------------------------------------------------
// ImageOp — discriminated union ADT
// ---------------------------------------------------------------------------

/**
 * A single image-processing operation described as a pure data
 * structure.
 *
 * The union is **discriminated** on the `_tag` field so consumers can
 * exhaustively pattern-match (or use `switch` / `if-else` chains).
 *
 * Adapters receive the full `ImageOp[]` list at execution time and can
 * batch-optimise natively (e.g. sharp applies all transforms in one
 * pipeline chain).  Validation happens eagerly at pipeline-build time;
 * unsupported operations are rejected before any I/O occurs.
 *
 * @example
 * ```ts
 * const ops: ImageOp[] = [
 *   { _tag: "Resize", width: 200, height: 200, fit: "cover" },
 *   { _tag: "Grayscale" },
 *   { _tag: "Format", format: "webp" },
 * ];
 * ```
 */
export type ImageOp =
  | {
      readonly _tag: "Resize";
      /** Target width in pixels. */
      readonly width?: number;
      /** Target height in pixels. */
      readonly height?: number;
      /** Fit strategy (see {@link Fit}). */
      readonly fit?: Fit;
    }
  | {
      readonly _tag: "Grayscale";
    }
  | {
      readonly _tag: "Format";
      /** Target output format. */
      readonly format: ImageFormat;
    }
  | {
      readonly _tag: "Crop";
      /** Left edge pixel coordinate. */
      readonly x: number;
      /** Top edge pixel coordinate. */
      readonly y: number;
      /** Width of the cropped region in pixels. */
      readonly width: number;
      /** Height of the cropped region in pixels. */
      readonly height: number;
    }
  | {
      readonly _tag: "Rotate";
      /** Rotation angle in degrees. Positive = clockwise. */
      readonly degrees: number;
    }
  | {
      readonly _tag: "Flip";
    }
  | {
      readonly _tag: "Flop";
    }
  | {
      readonly _tag: "Blur";
      /** Gaussian blur sigma (>= 0.3, sharp constraint). */
      readonly sigma: number;
    }
  | {
      readonly _tag: "Sharpen";
    }
  | {
      readonly _tag: "Negate";
    }
  | {
      readonly _tag: "Tint";
      /** Red channel multiplier (0-255). */
      readonly r: number;
      /** Green channel multiplier (0-255). */
      readonly g: number;
      /** Blue channel multiplier (0-255). */
      readonly b: number;
    }
  | {
      readonly _tag: "Effect";
      /**
       * Escape hatch for effectful mid-pipeline operations that don't
       * fit into the standard ADT variants.
       *
       * The function receives the current image and returns a
       * transformed one.  Adapter implementations apply this inline
       * during the pipeline execution.
       *
       * **Important:** This is intentionally typed as `(img: any) =>
       * any` to avoid circular type dependencies on `ImageData` and
       * `ImageError`, which are defined elsewhere.  The actual
       * signature is `(img: ImageData) => Effect.Effect<ImageData,
       * ImageError>`.
       */
      readonly effect: (img: any) => any;
    };

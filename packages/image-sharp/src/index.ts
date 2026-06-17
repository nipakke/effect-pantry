/**
 * Sharp-based image processing adapter for @effect-pantry/image.
 *
 * Provides the SharpAdapter implementing ImageAdapter via the sharp library.
 *
 * @example
 * ```ts
 * import { Image, layer } from "@effect-pantry/image"
 * import { Sharp } from "@effect-pantry/image-sharp"
 *
 * const imageLayer = layer.pipe(Layer.provide(Sharp))
 * ```
 *
 * @module
 */

export { SharpAdapter } from "./adapter.js";
export { Sharp } from "./adapter.js";

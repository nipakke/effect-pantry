/**
 * Extending sharp's instance — mutate the real Sharp object in-place
 * to replace Promise-based terminal methods with Effect-based ones.
 *
 * Because sharp's chainable methods (.resize, .grayscale, etc.) return
 * `this`, the overrides survive through the entire chain at runtime.
 *
 * TypeScript limitation: sharp's `.d.ts` types .resize() as returning
 * `Sharp`, which has `toBuffer(): Promise`. TS won't know about our
 * Effect overrides after a chain call. Use `as any` at the terminal
 * or store the pipeline in a variable first.
 */

import sharp from "sharp";
import { Effect } from "effect";
import { FileSystem } from "@effect/platform";
import { toImageError } from "./errors.js";

/**
 * Create a Sharp pipeline with Effect-based terminal methods.
 *
 * @example
 * ```ts
 * import { image } from "@effect-pantry/image";
 *
 * const program = Effect.gen(function* () {
 *   const $ = image(buf).resize(200, 200).grayscale().webp();
 *   const result = yield* $.toBuffer(); // Effect, not Promise
 * });
 * ```
 */
export const image = (input: Parameters<typeof sharp>[0]) => {
  const $ = sharp(input);

  // Snapshot original methods before overriding
  const _toBuffer = $.toBuffer.bind($);
  const _metadata = $.metadata.bind($);

  // Override toBuffer → Effect
  ($ as any).toBuffer = () =>
    Effect.tryPromise({
      try: () => _toBuffer({ resolveWithObject: false }) as Promise<Buffer>,
      catch: toImageError,
    });

  // Override metadata → Effect
  ($ as any).metadata = () =>
    Effect.tryPromise({
      try: () => _metadata(),
      catch: toImageError,
    });

  // Add toFile (uses Effect's FileSystem instead of sharp's raw fs)
  ($ as any).toFile = (path: string) =>
    Effect.gen(function* () {
      const buf = yield* Effect.tryPromise({
        try: () => _toBuffer({ resolveWithObject: false }) as Promise<Buffer>,
        catch: toImageError,
      });
      const fs = yield* FileSystem;
      yield* fs.writeFile(path, buf);
      return { path, size: buf.length };
    });

  return $;
};

// Keep the sharp import available for consumers who want raw access
export { sharp };

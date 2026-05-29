import * as FilesSDK from 'files-sdk';
import { bridgeProgress } from '../internal.js';

/** Options for {@link transfer}, with `signal` and `onProgress` managed internally. */
export type TransferOptions = Omit<FilesSDK.TransferOptions, 'signal' | 'onProgress'>;

/**
 * Cross-provider migration: walks every object the `source` exposes and
 * streams each one straight to `dest`, whatever the backends are.
 *
 * Returns an `{ result, progress }` pair where `result` is a **deferred
 * Effect** — the transfer does not start until you `yield*` it, and
 * `progress` is a {@link Stream} of {@link FilesSDK.TransferProgress}
 * events emitted while the transfer runs. Consume the stream concurrently
 * with the result:
 *
 * @example
 * ```ts
 * import { s3 } from "files-sdk/s3";
 * import { r2 } from "files-sdk/r2";
 * import * as FilesSDK from "files-sdk";
 * import { transfer } from "@effect-pantry/storage";
 *
 * const from = new FilesSDK.Files({ adapter: s3({ bucket: "old" }) });
 * const to   = new FilesSDK.Files({ adapter: r2({ bucket: "new", ... }) });
 *
 * // With progress — fork the stream consumer before awaiting the result
 * const { result, progress } = yield* transfer(from, to, { prefix: "uploads/" });
 * yield* Stream.runForEach(progress, (p) =>
 *   Effect.log(`${p.status} ${p.key} (${p.done}/${p.total})`)
 * ).pipe(Effect.forkScoped);
 * const { transferred, skipped, errors } = yield* result;
 *
 * // Without progress — just yield the result
 * const { transferred, skipped, errors } = yield* transfer(from, to).pipe(
 *   Effect.flatMap(({ result }) => result)
 * );
 * ```
 *
 * Both arguments are full {@link FilesSDK.Files} instances, not raw
 * adapters, so each leg honors its own `prefix`, retries, timeouts, and
 * hooks.
 *
 * @returns An {@link Effect} resolving to `{ result, progress }` where
 *   `result` is a deferred effect that yields a
 *   {@link FilesSDK.TransferResult} when executed, and `progress` is a
 *   stream of {@link FilesSDK.TransferProgress} events.
 */
export const transfer = (source: FilesSDK.Files, dest: FilesSDK.Files, opts?: TransferOptions) =>
  bridgeProgress<FilesSDK.TransferResult, FilesSDK.TransferProgress>((signal, onProgress) =>
    FilesSDK.transfer(source, dest, { ...opts, signal, onProgress }),
  );

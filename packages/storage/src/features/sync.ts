import * as FilesSDK from 'files-sdk';
import { bridgeProgress } from '../internal.js';

/** Options for {@link sync}, with `signal` and `onProgress` managed internally. */
export type SyncOptions = Omit<FilesSDK.SyncOptions, 'signal' | 'onProgress'>;

/**
 * Mirror one `Files` instance onto another — skip unchanged keys, prune
 * extraneous ones, and dry-run the plan first. The incremental sibling of
 * {@link transfer}.
 *
 * Returns an `{ result, progress }` pair where `result` is a **deferred
 * Effect** — the sync does not start until you `yield*` it, and `progress`
 * is a {@link Stream} of {@link FilesSDK.SyncProgress} events. Consume the
 * stream concurrently with the result:
 *
 * @example
 * ```ts
 * import { s3 } from "files-sdk/s3";
 * import { r2 } from "files-sdk/r2";
 * import * as FilesSDK from "files-sdk";
 * import { sync } from "@effect-pantry/storage";
 *
 * const from = new FilesSDK.Files({ adapter: s3({ bucket: "live" }) });
 * const to   = new FilesSDK.Files({ adapter: r2({ bucket: "backup", ... }) });
 *
 * // With progress — fork the stream consumer before awaiting the result
 * const { result, progress } = yield* sync(from, to, { prefix: "uploads/", prune: true });
 * yield* Stream.runForEach(progress, (p) =>
 *   Effect.log(`${p.status} ${p.key} (${p.done}/${p.total})`)
 * ).pipe(Effect.forkScoped);
 * const { uploaded, deleted, errors } = yield* result;
 * ```
 *
 * Both arguments are full {@link FilesSDK.Files} instances, not raw adapters,
 * so each leg honors its own `prefix`, retries, timeouts, and hooks.
 *
 * @returns An {@link Effect} resolving to `{ result, progress }` where
 *   `result` is a deferred effect that yields a {@link FilesSDK.SyncResult}
 *   when executed, and `progress` is a stream of {@link FilesSDK.SyncProgress}
 *   events.
 */
export const sync = (source: FilesSDK.Files, dest: FilesSDK.Files, opts?: SyncOptions) =>
  bridgeProgress<FilesSDK.SyncResult, FilesSDK.SyncProgress>((signal, onProgress) =>
    FilesSDK.sync(source, dest, { ...opts, signal, onProgress }),
  );

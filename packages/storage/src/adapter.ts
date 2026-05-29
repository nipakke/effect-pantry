import * as FilesSDK from 'files-sdk';
import { Context } from 'effect';

/**
 * The `files-sdk` {@link FilesSDK.Adapter} powering the {@link Storage} service.
 *
 * Provide via `Layer.succeed(StorageAdapter, myAdapter)` to plug any of
 * the 40+ adapters (memory, fs, S3, R2, Vercel Blob, …) into the service.
 */
export class StorageAdapter extends Context.Tag('@effect-pantry/storage/Adapter')<
  StorageAdapter,
  FilesSDK.Adapter
>() {}

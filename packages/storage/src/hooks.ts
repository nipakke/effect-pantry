import type { FilesActionEvent, FilesErrorEvent, FilesRetryEvent } from 'files-sdk';

/**
 * Discriminated union of every hook event emitted through the PubSub.
 *
 * Use {@link Storage.hookStream} to subscribe to a single kind of event;
 * the stream filters on `_tag` automatically.
 */
export type HookEvent =
  | { readonly _tag: 'onAction'; readonly event: FilesActionEvent }
  | { readonly _tag: 'onError'; readonly event: FilesErrorEvent }
  | { readonly _tag: 'onRetry'; readonly event: FilesRetryEvent };

/** Maps each constructor hook name to its event payload type. */
export interface HookEventMap {
  readonly onAction: FilesActionEvent;
  readonly onError: FilesErrorEvent;
  readonly onRetry: FilesRetryEvent;
}

/** The three constructor hook names supported by files-sdk. */
export type HookName = keyof HookEventMap;

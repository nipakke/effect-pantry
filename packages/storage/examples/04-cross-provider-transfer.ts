/**
 * Example 04: Cross-Provider Transfer
 *
 * Migrate objects from one storage backend to another without
 * downloading to disk. transfer() streams every object the source
 * exposes straight into the destination.
 *
 * This demo uses two in-memory Files instances, but the same
 * code works with s3 ↔ r2 or any adapter pair.
 *
 * Run:  npx tsx examples/04-cross-provider-transfer.ts
 */

// oxlint-disable no-console

import * as FilesSDK from 'files-sdk';
import { memory } from 'files-sdk/memory';
import { transfer } from '../src/index.js';
import { Console, Effect, Stream } from 'effect';

// ── Setup source & destination ───────────────────────────────────────
// Both are full FilesSDK.Files instances — each honors its own
// prefix, retries, timeouts, and hooks.

const source = new FilesSDK.Files({
  adapter: memory({
    initial: {
      'a.txt': 'content-a',
      'b.txt': 'content-b',
      'c.txt': 'content-c',
    },
  }),
});

const dest = new FilesSDK.Files({
  adapter: memory(),
});

// ── Program ───────────────────────────────────────────────────────────
const program = Effect.gen(function* () {
  const { result, progress } = yield* transfer(source, dest, {
    concurrency: 4,
  });

  // Fork progress stream — runs concurrently with the transfer
  yield* Stream.runForEach(progress, (p) =>
    Effect.gen(function* () {
      const pct = p.total > 0 ? ((p.done / p.total) * 100).toFixed(0) : '?';
      yield* Console.log(`[${p.status}] ${p.key} — ${p.done}/${p.total} (${pct}%)`);
    }),
  ).pipe(Effect.forkScoped);

  // Await the transfer result
  const { transferred, skipped, errors } = yield* result;

  console.log(`\nDone: ${transferred.length} transferred, ${skipped?.length ?? 0} skipped`);
  if (errors && errors.length > 0) {
    console.log(`${errors.length} errors:`);
    for (const e of errors) {
      console.log(`  ${e.key}: ${e.error.message}`);
    }
  }

  // Verify destination received the files
  const list = yield* Effect.tryPromise(() => dest.list({}));
  console.log(`Destination keys: ${list.items.map((i) => i.key).join(', ')}`);
});

// Effect.forkScoped requires a Scope — wrap the program in Effect.scoped
const scoped = Effect.scoped(program);
await Effect.runPromise(scoped);

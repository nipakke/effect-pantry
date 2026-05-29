<!-- Context: project-intelligence/notes | Priority: high | Version: 2.0 | Updated: 2026-05-16 -->

# Living Notes

> Active issues, technical debt, open questions, and insights that don't fit elsewhere. Keep this alive.

## Quick Reference

- **Purpose**: Capture current state, problems, and open questions
- **Update**: Weekly or when status changes
- **Archive**: Move resolved items to bottom with status

## Technical Debt

| Item                                    | Impact                              | Priority | Mitigation                              |
| --------------------------------------- | ----------------------------------- | -------- | --------------------------------------- |
| `@effect/vitest` + vitest 3.x fragility | Tests break on vitest minor updates | Medium   | Pin vitest version, watch changelogs    |
| No Effect 4 migration path yet          | Future compatibility                | Low      | Dual catalog system provides foundation |

## Known Issues

| Issue                                      | Severity | Workaround                                            | Status |
| ------------------------------------------ | -------- | ----------------------------------------------------- | ------ |
| `@effect/vitest` + `vp test` dual instance | High     | Use `vitest run` instead of `vp test`                 | Fixed  |
| `Effect.sleep` hangs in `it.scoped` tests  | Medium   | Use `Stream.take(n).runCollect` with `Effect.timeout` | Known  |

### Issue Details

**`@effect/vitest` + `vp test` = Dual Instance "No test suite found"**
_Severity_: High
_Impact_: All test files fail when using `vp test`
_Root Cause_: `@effect/vitest` imports `vitest` primitives, `vp test` uses `@voidzero-dev/vite-plus-test` (a vitest fork) as runner. Different module singletons → tests register on one, runner looks on the other.
_Fix_: Use `vitest run` as the test script. `vitest` must be an explicit devDependency.
_Status_: Fixed in package.json: `"test": "vitest run"`

**`Effect.sleep` doesn't work inside `@effect/vitest`'s `it.scoped`**
_Severity_: Medium
_Impact_: Tests hang when using `Effect.sleep` inside `it.scoped`
_Root Cause_: `@effect/vitest` v0.29.0 / vitest integration issue
_Workaround_: Use `Stream.take(n).pipe(Stream.runCollect, Effect.timeout(...))` or `Effect.promise(() => ...)` for async operations
_Status_: Known — awaiting upstream fix

## Insights & Lessons Learned

### Hard Rules

- **Never use inline `import()` type expressions in test or source files** — e.g. `opts?: import("../src/service.js").UploadOptions`. These are brittle: they break silently when types move between files, don't appear in grep/dead-code analysis, and bypass the module resolution that `tsc` and bundlers rely on. Always use a top-level `import type { ... } from "..."` statement instead.
- **Never use `Context.Tag` as a type annotation for service parameters** — e.g. `svc: Storage` where `Storage` is a `Context.Tag`. The tag class is not the service shape. Always use `Context.Tag.Service<typeof Storage>` for function parameters. TypeScript infers correctly inside `Effect.gen(function* () { const svc = yield* Storage })` but explicit annotations need the service type.

### What Works Well

- **Scope-based resource management** — The `watch()` function requires `Scope.Scope` and uses `Effect.acquireRelease` to manage the chokidar watcher lifecycle. When the scope closes, chokidar is automatically cleaned up — no manual resource tracking needed.
- **Per-event stream subscriptions** — Each call to `controller.stream(event)` independently registers chokidar listeners. Subscribers only receive events they care about (filtered via chokidar's "all" event), keeping consumer code focused and memory-efficient.
- **Effect-TS tagged errors** — Using `Data.TaggedError` for the error hierarchy (`WatchLimitReached`, `WatchPermissionDenied`, `WatchPathNotFound`, `WatchUnknownError`) makes error handling exhaustive and type-safe with `Effect.catchTag`.
- **Module splitting by responsibility** — 5 focused files (`watch.ts`, `events.ts`, `errors.ts`, `types.ts`, `index.ts`) each <100 lines with a clean dependency graph: types ← events → errors → watch → index.

### What Could Be Better

- `@effect/vitest` compatibility with vitest 3.x — the `it.layer` and `it.scoped` patterns work with `vitest run` but are fragile. If vitest's internal API changes (e.g., `ctx.onTestFinished`), `@effect/vitest` breaks silently.
- Benchmarks use bun (for mitata) but tests use vitest — two runtimes for dev workflows.
- Effect 4 migration — the dual catalog system (effect3/effect4) is in place but no code uses effect4 yet.

### Lessons Learned

- **Dual vitest instances with `@effect/vitest` and `vite-plus`** — `@effect/vitest` re-exports vitest's test registration primitives via `import * as V from "vitest"`. When `vp test` runs, it uses `@voidzero-dev/vite-plus-test` (an internal vitest fork) as the runner. Different module singletons → all tests break. Fix: use `vitest run`. Quick diagnosis: if `npx vitest run` passes but `pnpm test` fails, it's this issue.
- **`Effect.runFork` and `Effect.forkScoped` don't work in `it.scoped` tests** — Fibers created via `runFork` or `forkScoped` never execute in `@effect/vitest`'s scoped test environment. Bridge callbacks to Effect state using `Queue.unsafeOffer` instead.
  - **Update 2026-05-29**: Verified with `@effect/vitest` v0.29.0 + vitest 3.2.4 — `forkScoped` inside `Effect.gen` called from `it.scoped` works correctly. `Effect.fork` + `Fiber.join` also works. The known issue appears resolved in this version combination. If this breaks on future updates, fall back to `Queue.unsafeOffer` bridging.
- **Run tests with `vitest run`, not `bun test` or `vp test`** — Only `vitest run` uses the exact vitest instance that `@effect/vitest` registered with.

## Patterns & Conventions

### Code Patterns Worth Preserving

- **Effect-TS namespace imports** — `import { Effect, Stream, Deferred } from 'effect'` gives namespace objects. Types are accessed as `Effect.Effect<A, E, R>`, `Scope.Scope`, `Stream.Stream<A, E, R>`. Same for `@effect/platform`.
- **`it.layer` from `@effect/vitest`** for providing Effect layers to test blocks — `it.layer(Layer)(name, it => { it.effect(...) })`. Use `it.scoped` for tests needing auto-cleanup via `makeTempDirectoryScoped`.
- **Test import conventions** — Pure function tests use `from 'vitest'` with `describe`/`it`/`expect`. Effect code tests use `from '@effect/vitest'` with `it.effect` / `it.layer`. Never use bun's test runner.
- **`Data.TaggedClass` / `Data.TaggedError`** for typed events and errors with exhaustive pattern matching support.

### Gotchas for Maintainers

- **Effect imports are namespace objects, not types** — `import { Scope } from "effect"` gives a namespace/object, not a type. The actual type is `Scope.Scope`. Same for all Effect modules (`Stream`, `Queue`, `Chunk`, etc.).
- **chokidar's "all" event is the integration point** — Every stream subscriber hooks into chokidar's single "all" event and filters client-side. This is more efficient than registering per-event listeners.
- **`Stream.asyncPush` with `bufferSize: 16, strategy: 'dropping'`** — The stream buffer is set to drop events when consumers can't keep up, preventing backpressure from blocking the chokidar event loop.
- **`Effect.acquireRelease` for chokidar cleanup** — The acquire callback calls `chokidar.watch()`, the release callback calls `w.close()`. Wrapping in `Effect.promise` ensures async cleanup.

## Active Projects

| Project            | Goal                                    | Owner | Timeline    |
| ------------------ | --------------------------------------- | ----- | ----------- |
| Initial release    | Publish `@effect-pantry/watch-fs` v0.1   | -     | In progress |
| Effect 4 migration | Migrate from effect3 to effect4 catalog | -     | Future      |

### Resolved: Dual vitest instance (`@effect/vitest` + `vp test`)

- **Resolved**: 2026-05-13
- **Resolution**: Changed test script from `"vp test"` to `"vitest run"`.
- **Learnings**: Any library that re-exports vitest primitives will break with `vp test` unless the `vitest` package is overridden to resolve to `vite-plus-test`. Quick diagnosis: if `npx vitest run` passes but `pnpm test` fails, it's the dual instance issue.

## Onboarding Checklist

- [ ] Review known technical debt and understand impact
- [ ] Know what open questions exist and who's involved
- [ ] Understand current issues and workarounds
- [ ] Be aware of patterns and gotchas for Effect-TS + vitest
- [ ] Know active projects and timelines

## Related Files

- `business-domain.md` - Business context for current priorities
- `technical-domain.md` - Technical context for current state

<!-- Context: project-intelligence/business | Priority: high | Version: 2.0 | Updated: 2026-05-16 -->

# Business Domain

> Document the business context, problems solved, and value created.

## Quick Reference

- **Purpose**: Understand why this project exists
- **Update When**: Business direction changes, new features shipped, pivot
- **Audience**: Developers needing context, stakeholders, product team

## Project Identity

```
Project Name: effect-pantry / @effect-pantry/watch-fs
Tagline: Effect-TS native file watching for the Effect ecosystem
Problem Statement: chokidar is callback-based and not integrated with
  Effect-TS's resource management, error handling, and streaming primitives
Solution: Wrap chokidar as typed Effect Streams with Scope-based lifecycle
  management and a comprehensive typed error hierarchy
```

## Target Users

| User Segment | Who They Are | What They Need | Pain Points |
|--------------|--------------|----------------|-------------|
| Primary | Effect-TS application developers | File watching that integrates with Effect's runtime, scopes, and error handling | Callback-based libraries don't compose with Effect workflows; manual resource cleanup is error-prone |
| Secondary | Tool/CLI authors using Effect | Reusable, typed file watching with minimal boilerplate | No standard Effect-native file watcher exists; reinventing resource management per project |

## Value Proposition

**For Users**:
- Type-safe file watching with exhaustive error handling (`WatchLimitReached`, `WatchPermissionDenied`, `WatchPathNotFound`)
- Automatic resource cleanup via Effect `Scope` — no manual `watcher.close()` calls
- Stream-based API that composes with Effect's `Stream` combinators (`filter`, `map`, `groupByKey`, etc.)
- Dynamic add/unwatch at runtime without restarting the watcher

**For Business**:
- Foundation for future Effect-pantry tools (build watchers, hot-reload systems, file-syncing utilities)
- Demonstrates Effect-TS ecosystem integration patterns

## Success Metrics

| Metric | Definition | Target | Current |
|--------|------------|--------|---------|
| API surface | Number of exports in public API | <10 exports | 8 exports |
| Bundle size | Minified ESM bundle | <20KB | TBD |
| Test coverage | Line coverage via vitest | >80% | TBD |
| Release readiness | Package passing CI, changesets configured | Ready | In progress |

## Key Stakeholders

| Role | Name | Responsibility | Contact |
|------|------|----------------|---------|
| Maintainer | - | Package development and release | - |

## Roadmap Context

**Current Focus**: Initial release of `@effect-pantry/watch-fs` v0.1 — stable API, passing tests, CI pipeline
**Next Milestone**: Publish to npm, gather early feedback
**Long-term Vision**: Effect-pantry ecosystem of Effect-native tools (file watching, path walking, build utilities)

## Business Constraints

- Must use Effect-TS v3.x (current stable) with migration path to v4 via dual catalogs — seamless upgrade for consumers
- Monorepo must remain private until packages are release-ready
- catalogMode: strict enforced for supply-chain security

## Onboarding Checklist

- [ ] Understand the problem statement and why an Effect-native file watcher matters
- [ ] Identify target users (Effect-TS developers)
- [ ] Know the key value proposition (typed, scoped, composable)
- [ ] Understand success metrics and roadmap priorities
- [ ] Know who the stakeholders are

## Related Files

- `technical-domain.md` - How this business need is solved technically
- `living-notes.md` - Current open questions and issues

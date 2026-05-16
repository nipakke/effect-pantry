<!-- Context: project-intelligence/technical | Priority: high | Version: 2.0 | Updated: 2026-05-16 -->

# Technical Domain

> Document the technical foundation, architecture, and key decisions.

## Quick Reference

- **Purpose**: Understand how the project works technically
- **Update When**: New features, refactoring, tech stack changes
- **Audience**: Developers, DevOps, technical stakeholders

## Primary Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | ^6.0 | Latest TS features, const type parameters, better inference |
| Runtime | Node.js | 22+ | LTS, stable ES modules |
| Package Manager | pnpm | 11.x | Strict catalog mode, workspace protocol, supply-chain security |
| Build | vite-plus (vp) | ^0.1.21 | Dual ESM/CJS output, fast builds, shared config |
| Core Library | effect | ^3.21.2 | Typed effects, Scope management, Streams, fibers |
| Platform | @effect/platform | ^0.90.10 | Cross-platform FileSystem, Path abstractions |
| Platform Node | @effect/platform-node | ^0.96.1 | Node.js runtime integration for Effect |
| File Watching | chokidar | ^5.0 | Mature, cross-platform fs.watch wrapper with polling fallback |
| Testing | vitest | ^3.2 | Fast, Vite-native test runner |
| Effect Testing | @effect/vitest | ^0.29.0 | it.layer, it.scoped, it.effect for Effect tests |
| Versioning | @changesets/cli | ^2.28 | Automated changelog generation, semver management |
| CI | GitHub Actions | - | Build, test, lint pipeline |

## Architecture Pattern

```
Type: Monorepo (pnpm workspaces)
Pattern: Packages + Shared Tooling
Packages: packages/watch-fs/ (main library)
Tooling:  tooling/tsconfig/ (shared TS config)
          tooling/vite-config/ (shared vite-plus config)
```

### Why This Architecture?

The monorepo pattern with separate tooling packages avoids config duplication. Each package shares TS and build config via workspace references (`"@tooling/tsconfig": "workspace:*"`). The dual catalog system (effect3/effect4) enables gradual migration when Effect v4 stabilizes.

## Project Structure

```
effect-pantry/
├── packages/
│   └── watch-fs/                # @effect-pantry/watch-fs
│       ├── src/
│       │   ├── watch.ts          # Main watch() function + WatchController
│       │   ├── events.ts         # WatchEvent tagged class, WatchEventName type
│       │   ├── errors.ts         # Error hierarchy (4 tagged errors)
│       │   ├── types.ts          # WatchController, WatchOptions interfaces
│       │   └── index.ts          # Public API barrel export
│       └── tests/
├── tooling/
│   ├── tsconfig/
│   │   └── tsconfig.base.json   # Shared strict TS config
│   └── vite-config/
│       └── src/index.ts         # Shared vite-plus build config
├── pnpm-workspace.yaml          # Workspace def, catalogs, security policies
├── pnpm-lock.yaml
└── package.json                 # Root scripts and metadata
```

**Key Directories**:
- `packages/watch-fs/src/` — 5 source files, each <100 lines, single responsibility
- `tooling/tsconfig/` — Shared TypeScript configuration with strict mode
- `tooling/vite-config/` — Shared build configuration for vite-plus

## Key Technical Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Effect-TS v3 (not v4) | v4 is not yet stable; v3 has mature ecosystem | Stable foundation, dual catalog prepares for migration |
| Dual pnpm catalogs (effect3/effect4) | Allows seamless migration when v4 stabilizes | No breaking changes for consumers; catalog swap |
| chokidar over @parcel/watcher | Mature, cross-platform, polling fallback | Reliability on all platforms including Linux |
| Scope-based resource management | Effect's Scope auto-cleanup prevents leaks | No manual watcher.close() needed |
| Stream-based API (not callback) | Composes with Effect's Stream combinators | Consumers can filter, map, batch, throttle events |
| Typed error hierarchy | Exhaustive error handling with catchTag | No uncaught runtime errors from watcher |
| vite-plus over tsc for builds | Faster, dual ESM/CJS output, shared config | Consistent build across all packages |
| changesets for versioning | Automated changelog, conventional commits | Clean release process |
| catalogMode: strict | Supply-chain security, reproducible builds | Every dependency version centrally managed |

## Integration Points

| System | Purpose | Protocol | Direction |
|--------|---------|----------|-----------|
| chokidar | Native file watching | Node.js EventEmitter | Inbound |
| @effect/platform | FS abstractions for tests | Effect Layer | Internal |
| @effect/vitest | Effect-aware test harness | Vitest plugin | Testing |
| vite-plus | Build and type checking | CLI (vp pack, vp check) | Build |

## Technical Constraints

| Constraint | Origin | Impact |
|------------|--------|--------|
| catalogMode: strict | Supply-chain security | All deps must be in pnpm-workspace.yaml catalogs |
| minimumReleaseAge: 4320 | Security policy | Packages must be at least 3 days old |
| strictDepBuilds: true | Build security | Only allowlisted packages can run install scripts |
| `@effect/vitest` + `vp test` incompatibility | Module singleton mismatch | Must use `vitest run` instead of `vp test` |

## Development Environment

```
Setup: pnpm install
Requirements: Node.js 22+, pnpm 11+
Local Dev: cd packages/watch-fs && pnpm build
Testing: cd packages/watch-fs && pnpm test
Typecheck: cd packages/watch-fs && pnpm typecheck
```

## Deployment

```
Environment: GitHub Packages / npm
Platform: npm registry
CI/CD: GitHub Actions (.github/workflows/)
Versioning: changesets with @changesets/cli
```

## Onboarding Checklist

- [ ] Know the primary tech stack and versions
- [ ] Understand the monorepo structure with shared tooling
- [ ] Know the key project directories and their purpose
- [ ] Understand major technical decisions (dual catalog, Effect v3, chokidar)
- [ ] Know integration points (chokidar → Effect Stream, @effect/vitest testing)
- [ ] Be able to set up local development environment (`pnpm install && pnpm build`)
- [ ] Know how to run tests (`vitest run`, not `vp test`)
- [ ] Understand catalogMode: strict and versioning with changesets

## Related Files

- `business-domain.md` - Why this technical foundation exists
- `living-notes.md` - Current issues, gotchas, and patterns

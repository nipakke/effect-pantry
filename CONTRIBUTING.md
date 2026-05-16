# Contributing to effect-pantry

Thanks for your interest in contributing. This document covers the setup, conventions, and workflow for making changes.

## Prerequisites

- [Node.js](https://nodejs.org) >= 24
- [pnpm](https://pnpm.io) >= 11

## Setup

```sh
git clone https://github.com/your-org/effect-pantry.git
cd effect-pantry
pnpm install
```

## Development Workflow

### 1. Find or Create an Issue

Check [existing issues](https://github.com/your-org/effect-pantry/issues) for something to work on. If you're fixing a bug or adding a feature, open an issue first to discuss the approach.

### 2. Create a Branch

```sh
git checkout -b feat/my-change
```

Branch naming:

| Pattern   | Purpose                   |
| --------- | ------------------------- |
| `feat/*`  | New features              |
| `fix/*`   | Bug fixes                 |
| `chore/*` | Tooling, CI, dependencies |
| `docs/*`  | Documentation             |

### 3. Make Changes

- Follow the code standards in `.opencode/context/core/standards/code-quality.md`
- Write tests for new functionality
- Keep changes focused — one logical change per PR

### 4. Run Checks

```sh
pnpm typecheck   # Type-check all packages
pnpm lint        # Lint all packages
pnpm build       # Build all packages
pnpm test        # Run all tests
```

All checks must pass before submitting.

### 5. Commit

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning. Commit messages should be descriptive:

```sh
git commit -m "feat: add recursive directory watching"
```

### 6. Create a Changeset

If your change affects published packages, create a changeset:

```sh
pnpm changeset
```

Follow the prompts to describe the change and select the semver bump type.

### 7. Submit a Pull Request

- Push your branch and open a PR against `main`
- Reference the issue number in the PR description (e.g., `Closes #123`)
- Ensure CI passes

## Code Standards

- **Modular, functional** — pure functions, immutability, composition
- **TypeScript** — strict mode, no unchecked index access
- **Tests** — vitest, co-located with source
- **Formatting** — managed by `vp fmt` (runs oxlint/oxfmt)

## Reporting Issues

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities. For bugs and feature requests, use the issue templates in GitHub.

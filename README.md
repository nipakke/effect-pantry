# effect-pantry

**Effect-native utilities for Node.js** — a monorepo of packages that extend the [Effect](https://effect.website) ecosystem with practical, well-tested tooling.

## Packages

| Package                                          | Description                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| [`@effect-pantry/watch-fs`](./packages/watch-fs) | Effect-native file watching — wraps chokidar as typed Effect streams with Scope-based resource management |

## Prerequisites

- [Node.js](https://nodejs.org) >= 26 (see `.node-version`)
- [pnpm](https://pnpm.io) >= 11

## Getting Started

```sh
git clone https://github.com/your-org/effect-pantry.git
cd effect-pantry
pnpm install
pnpm build
pnpm test
```

## Scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `pnpm build`     | Build all packages                |
| `pnpm test`      | Run all tests                     |
| `pnpm lint`      | Lint all packages                 |
| `pnpm fmt`       | Format all packages               |
| `pnpm check`     | Full project check (lint + types) |
| `pnpm typecheck` | Type-check all packages           |
| `pnpm changeset` | Create a changeset for versioning |
| `pnpm release`   | Build + publish to npm            |

## Repository Structure

```
effect-pantry/
├── packages/          # Published packages
│   └── watch-fs/
├── tooling/           # Internal build/config tooling
│   ├── tsconfig/
│   └── vite-config/
├── .github/           # CI, dependabot, templates
└── .changeset/        # Changeset versioning
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).

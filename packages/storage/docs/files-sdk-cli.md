# files-sdk CLI

> Extracted from https://files-sdk.dev/cli

## Overview

Agent-friendly CLI wrapping the same adapters as the SDK behind a single `files` binary — JSON-by-default output, stdin/stdout streaming, built-in MCP server.

Install globally:

```
npm install -g files-sdk
```

One-shot (no install):

```
npx -p files-sdk files --provider fs --root ./uploads list
```

Provider SDKs loaded lazily. Install peer deps for your provider alongside the CLI.

## Pick a Provider

Pass `--provider <name>` per call, or set `FILES_SDK_PROVIDER` once. Credentials from standard env vars. Common short flags: `--bucket`, `--region`, `--endpoint`, `--root`, `--container`, `--token`. For long tail: `--config-json '{...}'` accepts raw adapter options.

## Commands

Each command maps to an SDK method:

| Command | SDK Method |
|---------|-----------|
| `upload` | `files.upload()` |
| `download` | `files.download()` |
| `head` | `files.head()` |
| `exists` | `files.exists()` |
| `delete` | `files.delete()` |
| `copy` | `files.copy()` |
| `move` | `files.move()` |
| `list` | `files.list()` |
| `url` | `files.url()` |
| `sign-upload` | `files.signedUploadUrl()` |
| `transfer` | `transfer()` |

## Output

JSON-by-default on stdout, error envelope on stderr, meaningful exit codes.

## Streaming & Dry-Run

Stream bodies through stdin/stdout (no temp files). `--dry-run` previews an operation before it runs.

## MCP Server

Built-in MCP server on stdio that exposes every CLI command as a tool, with provider and credentials bound at startup.

## Wiring Agents

Three patterns for handing storage access to an agent, ordered by trust: narrow-scope credentials, read-only access, or full access with approval gating.

## FAQ Highlights

- **Which providers?** 40+, full list under Adapters
- **Bundle all SDKs?** No — install only what you use
- **`ERR_MODULE_NOT_FOUND @aws-sdk/client-s3`?** Missing peer dep
- **Switch providers?** Swap the adapter in the constructor
- **Browser?** Use `signedUploadUrl()` on server, `fetch` on client
- **`delete` on missing key?** S3/R2/Vercel = idempotent; strict providers throw `NotFound`
- **`contentType` is `application/octet-stream`?** Can't infer from raw ArrayBuffer/stream/string; pass explicitly
- **`head`/`list` returns empty body?** Body accessors lazy-fetch on call — `StoredFile` is metadata only until you call `.arrayBuffer()` / `.text()` / etc.
- **CLI?** Yes — `files` binary, JSON output, MCP server

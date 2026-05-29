# files-sdk Installation & Providers

> Extracted from https://files-sdk.dev

## Installation

```
npm install files-sdk
```

- **Runtime**: ESM only (`"type": "module"`), Node 18+, Bun
- **One runtime dep**: `commander` (CLI)
- **Types**: Ships own `.d.ts` — no `@types/files-sdk`
- **Peer deps**: Per-adapter; not bundled. Install only what you use.

### Adapter Peer Dependencies

Adapters are subpath exports (`files-sdk/s3`, `files-sdk/r2`, …). Each provider SDK is an optional peer dependency, loaded lazily on first use.

For S3 (and every S3-compatible store — R2 over HTTP, MinIO, Backblaze, Wasabi, DigitalOcean Spaces, etc.):

```
npm install files-sdk @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner
```

For Google Cloud Storage: `@google-cloud/storage` + `google-auth-library`
For Azure: `@azure/storage-blob` + `@azure/core-auth` + `@azure/identity`
For Vercel Blob: `@vercel/blob` only
For `fs` and `bun-s3`: no extra packages (runtime primitives)

Missing a peer dep → `ERR_MODULE_NOT_FOUND` naming the missing package.

## Provider Catalog

40+ adapters behind one API:

**S3 & Compatible**: AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi, DigitalOcean Spaces, Scaleway, OVHcloud, Hetzner, Tigris, Storj, Filebase, Akamai, iDrive e2, Vultr, IBM COS, Oracle Cloud, Exoscale, Tencent COS, Alibaba OSS, Yandex, Bun S3

**Cloud Storage**: Google Cloud Storage, Azure Blob Storage, Firebase Storage

**Platforms**: Vercel Blob, Netlify Blobs, Supabase Storage, UploadThing, Cloudinary, Bunny Storage

**Consumer**: Dropbox, Box, Google Drive, OneDrive, SharePoint

**BaaS**: Appwrite, PocketBase, Convex

**Local**: `fs` (filesystem), `memory` (in-memory Map), FTP, SFTP

### `files-sdk/providers` Subpath

A static, zero-dependency catalog — imports no provider SDKs. Usable in build scripts, config UIs, sync engines.

```ts
import { PROVIDER_NAMES, getProvider } from "files-sdk/providers";

for (const slug of PROVIDER_NAMES) {
  const provider = getProvider(slug)!;
  console.log(provider.name, provider.peerDeps);
}
```

Helpers:
- `getProvider(slug)` — lookup; returns `undefined` for unknown
- `listEnvVars(slug)` — all env vars, deduplicated
- `getSecretEnvVars(slug)` — subset flagged as secrets

### Environment Variable Model

- **`required`** — always needed (e.g. `SUPABASE_URL`)
- **`credentialModes`** — mutually exclusive groups; satisfy exactly one
- **`optional`** — tuning, safe to omit
- **`config`** — non-env constructor options (`bucket`, `region`, `endpoint`)

Each variable tagged: `secret` (boolean), `readBy` (`"files-sdk"` or `"sdk-chain"` for provider SDK credential chain).

Key types: `Provider`, `ProviderEnvSpec`, `EnvGroup`, `EnvVar`.

## Switching Providers

Swap the adapter — all call sites below the constructor stay identical:

```ts
import { Files } from "files-sdk";
import { s3 } from "files-sdk/s3";
import { r2 } from "files-sdk/r2";
import { vercelBlob } from "files-sdk/vercel-blob";

const files = new Files({ adapter: s3({ bucket, region }) });
// → switch to r2: new Files({ adapter: r2({ ... }) })
// → switch to vercelBlob: new Files({ adapter: vercelBlob({ token }) })
```

## Adapter Compatibility

Where a provider lacks a primitive, the method throws `FilesError` rather than silently misbehaving (e.g. `signedUploadUrl` on Vercel Blob). Each adapter's docs page has a Compatibility section. `files.raw` provides the typed escape hatch for anything outside the unified surface.

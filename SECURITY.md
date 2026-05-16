# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅ Yes    |
| older   | ❌ No     |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately by opening a GitHub Security Advisory:

1. Go to https://github.com/your-org/effect-pantry/security/advisories
2. Click **"New advisory"**
3. Fill in the details — we'll respond within 48 hours

Please do **not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

## What to Include

- A clear description of the vulnerability
- Steps to reproduce (PoC preferred)
- Affected versions
- Potential impact
- Any suggested fix (if known)

## Process

1. We acknowledge receipt within 48 hours
2. We investigate and confirm the issue
3. We develop and test a fix
4. We release a patch and publish the advisory

## Security Best Practices

- Use the latest version of all packages
- Run `pnpm audit` regularly to check for known vulnerabilities
- Dependencies are managed through pnpm's supply-chain security features (minimum release age, trusted dependency policies) — see `pnpm-workspace.yaml`

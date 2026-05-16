<!-- Context: workflows/external-libraries-scenarios | Priority: medium | Version: 1.0 | Updated: 2026-02-05 -->

# External Libraries: Common Scenarios

**Purpose**: Real-world examples of using ExternalScout

---

## Scenario 1: New Build with External Packages

**Example**: Effect-TS application with Drizzle + 

**Process:**

1. Check install scripts: `ls scripts/install/`
2. Identify packages: Effect-TS, Drizzle, Zod
3. ExternalScout for each package
4. Check requirements: PostgreSQL? Env vars?
5. Verify version compatibility
6. Implement following current docs
7. Test integration points

**ExternalScout calls:**

```javascript
// Drizzle ORM
task(
  subagent_type="ExternalScout",
  description="Fetch Drizzle PostgreSQL setup",
  prompt="Fetch Drizzle ORM docs: PostgreSQL setup w/ modular schemas
  Focus on: Installation | DB connection | Schema patterns | Migrations
  Context: Effect-TS backend site w/ PostgreSQL"
)

// Effect-TS Layer system
task(
  subagent_type="ExternalScout",
  description="Fetch Effect-TS Layer system docs",
  prompt="Fetch Effect-TS docs: Layer system w/ Effect services
  Focus on: Installation | Directory structure | Effect services
  Context: Commerce site w/ order processing"
)
```

---

## Scenario 2: Package Error During Build

**Example**: `Error: Cannot find module 'drizzle-orm/pg-core'`

**Process:**

1. Identify package: Drizzle ORM
2. ExternalScout: "Fetch Drizzle docs: PostgreSQL imports"
3. Check current import patterns
4. Verify package.json has correct deps
5. Propose fix from current docs
6. Request approval → Apply fix

---

## Scenario 3: First-Time Package Setup

**Example**: Setting up Effect-TS in Effect-TS

**Process:**

1. Check install scripts
2. ExternalScout: "Fetch Effect-TS docs: Effect-TS Layer system setup"
3. Get: Install steps | Peer deps | Config | Patterns
4. If install script exists: Review → Run
5. If no script: Follow docs for manual setup
6. Implement → Test

---

## Scenario 4: Version Upgrade

**Example**: Effect-TS v3 → 15

**Process:**

1. ExternalScout: "Fetch Effect-TS v4 docs: Breaking changes and migration"
2. Review breaking changes
3. Identify affected code
4. Plan migration steps
5. Request approval → Implement → Test

---

## Real-World Example: Auth Implementation

**Task**: "Add authentication with  to Effect-TS backend"

```javascript
// 1. ContextScout: Project standards
task(
  subagent_type="ContextScout",
  description="Find auth standards",
  prompt="Find context files: Auth patterns | Security standards"
)
// Returns: security-patterns.md, code-quality.md

// 2. ExternalScout:  docs (MANDATORY)
task(
  subagent_type="ExternalScout",
  description="Fetch  + Effect-TS docs",
  prompt="Fetch  docs: Effect-TS Layer system integration
  Focus on: Installation | Layer system setup | Drizzle adapter | Session mgmt
  Context: Adding auth to Effect-TS backend w/ Drizzle ORM"
)
// Returns: Installation | Integration patterns | Working examples

// 3. Combine and implement
// -  patterns (from ExternalScout)
// - Security standards (from ContextScout)
// = Secure, well-structured auth ✅
```

---

## Error Handling Patterns

| Error Type               | Process                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Package Installation** | ExternalScout: installation docs → Verify package name/version → Check peer deps |
| **Import/Module**        | ExternalScout: import patterns → Check current API exports                       |
| **API/Configuration**    | ExternalScout: API docs → Check current signatures                               |
| **Build Errors**         | Identify package → ExternalScout: relevant docs → Check known issues             |

---

## Related

- `external-libraries-workflow.md` - Core workflow
- `external-libraries-faq.md` - Troubleshooting FAQ

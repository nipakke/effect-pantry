# External Library Registry

## Purpose

This file lists external libraries/frameworks that should use **ExternalScout** (via Context7) for live documentation instead of relying on potentially outdated training data.

## When to Use This

**ContextScout** checks this list when:

1. User asks about a library/framework
2. No internal context exists in `.opencode/context/development/frameworks/`
3. Query matches a library name below

**Action**: Recommend **ExternalScout** subagent

---

## Supported Libraries

### Database & ORM

#### Drizzle ORM

- **Aliases**: `drizzle`, `drizzle-orm`, `drizzle orm`
- **Docs**: https://orm.drizzle.team/
- **Context7**: `use context7 for drizzle`
- **Common topics**: schema organization, migrations, relational queries, transactions, TypeScript types

#### Prisma

- **Aliases**: `prisma`
- **Docs**: https://www.prisma.io/docs
- **Context7**: `use context7 for prisma`
- **Common topics**: schema, migrations, client, relations, TypeScript

---

### Effect Ecosystem

#### Effect-TS

- **Aliases**: `effect`, `effect-ts`, `@effect/core`
- **Docs**: https://effect.website/
- **Context7**: `use context7 for effect-ts/effect`
- **Common topics**: Effect type, Gen, Schema, Layer, Scope, Fiber, Stream, Queue, Config, Data

---

### Infrastructure & Deployment

#### Cloudflare Workers

- **Aliases**: `cloudflare workers`, `cloudflare`, `workers`, `cf workers`
- **Docs**: https://developers.cloudflare.com/workers
- **Context7**: `use context7 for cloudflare workers`
- **Common topics**: routing, KV storage, Durable Objects, bindings, middleware

#### AWS Lambda

- **Aliases**: `aws lambda`, `lambda`, `aws λ`
- **Docs**: https://docs.aws.amazon.com/lambda
- **Context7**: `use context7 for aws lambda`
- **Common topics**: handlers, layers, environment variables, triggers, TypeScript

#### Vercel

- **Aliases**: `vercel`
- **Docs**: https://vercel.com/docs
- **Context7**: `use context7 for vercel`
- **Common topics**: deployment, environment variables, edge functions, serverless

---

### Validation

#### Zod

- **Aliases**: `zod`
- **Docs**: https://zod.dev/
- **Context7**: `use context7 for zod`
- **Common topics**: schema validation, TypeScript inference, parsing, refinements

---

### Testing

#### Vitest

- **Aliases**: `vitest`
- **Docs**: https://vitest.dev/
- **Context7**: `use context7 for vitest`
- **Common topics**: configuration, testing, mocking, coverage

---

## Detection Patterns

ContextScout and ExternalScout should match queries containing:

- Library name (case-insensitive)
- Common variations (e.g., "effect-ts" vs "effect ts")
- Package names (e.g., "@effect/schema")

**Examples**:

- "How do I use **Drizzle** with PostgreSQL?" → Match: Drizzle ORM
- "Show me **Effect-TS** Layer pattern setup" → Match: Effect-TS
- "**Zod** schema validation with TypeScript" → Match: Zod
- "**Vitest** configuration for monorepo" → Match: Vitest

---

## Query Optimization Patterns

### Drizzle ORM

| User Intent        | Optimized Query                                          |
| ------------------ | -------------------------------------------------------- |
| Setup/Installation | `PostgreSQL+setup+configuration+TypeScript+installation` |
| Modular schemas    | `modular+schema+organization+domain+driven+design`       |
| Relations          | `relational+queries+one+to+many+joins+with+relations`    |
| Migrations         | `drizzle-kit+migrations+generate+push+PostgreSQL`        |
| Transactions       | `database+transactions+patterns+TypeScript`              |
| Type safety        | `TypeScript+type+inference+schema+types+inferInsert`     |

### Effect-TS

| User Intent       | Optimized Query                                              |
| ----------------- | ------------------------------------------------------------ |
| Effect basics     | `Effect+type+gen+pipe+flatMap+map+TypeScript`               |
| Schema            | `Schema+struct+transform+decode+encode+TypeScript`          |
| Layer/DI          | `Layer+provide+dependency+injection+live+TypeScript`        |
| Scope management  | `Scope+acquireRelease+addFinalizer+lifecycle+TypeScript`    |
| Streams           | `Stream+fromIterable+runCollect+asyncPush+TypeScript`       |
| Error handling    | `Effect+catchTag+catchAll+orElse+tagged+error+TypeScript`   |
| Fiber/concurrency | `Fiber+fork+join+interrupt+concurrency+TypeScript`          |
| Config            | `Config+string+number+secret+redacted+TypeScript`           |

### Cloudflare Workers

| User Intent     | Optimized Query                                           |
| --------------- | --------------------------------------------------------- |
| Setup           | `getting+started+setup+TypeScript+wrangler+configuration` |
| Routing         | `routing+itty-router+hono+request+handling`               |
| KV storage      | `KV+storage+key+value+bindings+TypeScript`                |
| Durable Objects | `Durable+Objects+state+WebSockets+coordination`           |

### AWS Lambda

| User Intent           | Optimized Query                                          |
| --------------------- | -------------------------------------------------------- |
| Setup                 | `getting+started+setup+TypeScript+handler+configuration` |
| Handlers              | `handler+function+event+context+TypeScript+patterns`     |
| Layers                | `layers+dependencies+shared+code+deployment`             |
| Environment variables | `environment+variables+secrets+configuration+SSM`        |

---

## Adding New Libraries

To add a new library:

1. Add entry under appropriate category
2. Include: Name, aliases, docs link, Context7 command, common topics
3. (Optional) Add query optimization patterns
4. Update ExternalScout if needed (usually automatic)

**Template**:

```markdown
#### Library Name

- **Aliases**: `alias1`, `alias2`, `package-name`
- **Docs**: https://example.com/docs
- **Context7**: `use context7 for library-name`
- **Common topics**: topic1, topic2, topic3
```

---

## Usage by ExternalScout

ExternalScout uses this file to:

1. **Detect** which library the user is asking about
2. **Load** query optimization patterns for that library
3. **Build** optimized Context7 queries
4. **Fetch** live documentation
5. **Return** filtered, relevant results

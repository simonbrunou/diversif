# Postgres migration — handoff brief

**Audience:** a fresh Claude Code session picking up an in-progress migration from SQLite/better-sqlite3 to Postgres on the `worktree-postgres-migration` branch. The user wants the migration finished cleanly, no backwards-compat concerns (nobody is using the app yet — clean slate). Foundation is already in place; you finish the mechanical conversion + test infra + Docker.

---

## Get the work-in-progress branch

```bash
git fetch origin worktree-postgres-migration
# if you want to work in a worktree (recommended):
git worktree add .claude/worktrees/postgres-migration worktree-postgres-migration
cd .claude/worktrees/postgres-migration
npm install
```

The branch has one WIP commit on top of `main` with the foundation done.

## What is already done on the branch

- **`package.json`** — `better-sqlite3` and `@types/better-sqlite3` removed; `pg`, `@types/pg`, and `pg-mem` added.
- **`drizzle.config.ts`** — `dialect: 'postgresql'`, reads `DATABASE_URL` (defaults to `postgres://postgres:postgres@localhost:5432/diversif` for local dev).
- **`src/lib/server/db/schema.ts`** — full rewrite using `pgTable`, `serial`, `boolean`, `timestamp({ withTimezone: true, mode: 'date' })`. Type definitions at the bottom unchanged.
- **`src/lib/server/db/index.ts`** — pg `Pool`, `drizzle/node-postgres`, top-level `await` for `migrate()` + `seedFoods()` at module init. Exports `db` (sync handle, ready after import settles) and `pool`. Throws if `DATABASE_URL` is unset.
- **`src/lib/server/db/seed.ts`** — `seedFoods()` is now async; uses `db.execute(sql\`SELECT COUNT(\*)::text…\`)`for the empty-table check (returns`{ rows: [{count: '0'}] }`) then `await db.insert(foods).values(rows)`.
- **`src/lib/server/idempotency.ts`** — `withIdempotencyKey()` and `pruneExpiredKeys()` are async; `Tx` type alias now references `NodePgDatabase | PgTransaction<NodePgQueryResultHKT, ...>`. The fresh-key check uses `.limit(1)` then `[0]` instead of `.get()`. `result.rowCount` instead of `result.changes`.
- **`src/lib/server/auth.ts`** — every exported function is async. `db.transaction(async (tx) => …)` instead of sync. `.limit(1)` + `[0]` instead of `.get()`. Removed `.run()` / `.all()`.
- **Deleted:** `src/lib/server/db/backup.ts`, `src/lib/server/db/backup.test.ts`, `src/lib/server/db/migration.test.ts` (SQLite-only concerns; Coolify-managed Postgres handles backups, and the FK-during-migration test has no Postgres analogue).
- **Migrations** — all `drizzle/000{0..7}_*.sql` deleted along with their snapshots; `drizzle/0000_init.sql` regenerated fresh from the new pg schema. The `_journal.json` only has the one entry.

## Conversion pattern (use this on every remaining file)

For every `.run()` / `.get()` / `.all()` call:

| Before (SQLite, sync)                           | After (pg, async)                                        |
| ----------------------------------------------- | -------------------------------------------------------- |
| `db.insert(t).values(v).run()`                  | `await db.insert(t).values(v)`                           |
| `db.update(t).set(s).where(w).run()`            | `await db.update(t).set(s).where(w)`                     |
| `db.delete(t).where(w).run()`                   | `await db.delete(t).where(w)`                            |
| `db.select().from(t).where(w).get()`            | `(await db.select().from(t).where(w).limit(1))[0]`       |
| `db.select().from(t).where(w).all()`            | `await db.select().from(t).where(w)`                     |
| `db.insert(t).values(v).returning({...}).get()` | `(await db.insert(t).values(v).returning({...}))[0]`     |
| `result.changes`                                | `result.rowCount ?? 0`                                   |
| `db.transaction((tx) => { tx.foo().run() })`    | `await db.transaction(async (tx) => { await tx.foo() })` |

Type swap on every file that imported `BetterSQLite3Database`:

```ts
// before
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
type Tx = BetterSQLite3Database<typeof schema>;

// after
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
type Tx =
  | NodePgDatabase<typeof schema>
  | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;
```

Every function that did sync DB calls becomes `async`; every caller awaits and propagates async upward. SvelteKit `+page.server.ts` `load` and `actions` already permit `async`, so the conversion is mechanical.

## Remaining work, in order

### 1. Convert the rest of `src/lib/server/`

```
src/lib/server/passkeys.ts
src/lib/server/cleanup.ts
src/lib/server/gdpr.ts
src/lib/server/guidance/queries.ts
src/lib/server/guards.ts        # check it doesn't touch db; if it does, convert
```

Each gets the same pattern as `auth.ts`. Sentry calls and non-DB code stay as-is.

### 2. Convert every route file that imports `db` or any of those lib files

```bash
grep -rln "from '\$lib/server/db'\|from '\$lib/server/auth'\|from '\$lib/server/idempotency'\|from '\$lib/server/gdpr'\|from '\$lib/server/passkeys'" src/routes
```

That's ~20 files. Each `+page.server.ts` / `+server.ts` `load` / `actions` / handler becomes async on every DB call. The routes are independent — safe to dispatch parallel subagents.

### 3. Test infrastructure: pg-mem factory

Tests today do `new Database(':memory:')`. Replace with a pg-mem-based factory. Sketch:

```ts
// src/lib/server/db/test-db.ts
import { newDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function createTestDb() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem doesn't ship every pg builtin; register what we use
  mem.public.registerFunction({
    name: 'now',
    returns: 'timestamptz',
    implementation: () => new Date()
  });

  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const db = drizzle(pool, { schema });

  // Apply the single 0000_init.sql migration (pg-mem can run plain DDL).
  const sql = readFileSync(path.resolve('drizzle/0000_init.sql'), 'utf8');
  for (const stmt of sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)) {
    mem.public.none(stmt);
  }

  return { db, pool, mem };
}
```

**Caveats:** pg-mem doesn't implement every Postgres feature. If a test query uses something pg-mem doesn't support (e.g. some `ON CONFLICT` flavours, certain JSON ops), either work around in test or switch to `testcontainers` for that one test. For most CRUD tests pg-mem is fine and stays in-process.

### 4. Convert all `.test.ts` files

```bash
grep -rln "Database(':memory:')\|new Database(\|BetterSQLite3Database\|\.run()\|\.get()\|\.all()" src/ --include="*.test.ts"
```

For each: replace `new Database(':memory:')` setup with `createTestDb()`, await every DB call, async every test callback. The test file `src/routes/child/[id]/log/page.server.test.ts` has the most complex setup — start with simpler ones first.

### 5. Dockerfile

Drop the native-compile step. better-sqlite3 needed `python3 g++ make`; the `pg` driver is pure JS, so a vanilla Node Alpine base is enough. Also drop the `data/` volume mount path concerns from the runtime (Coolify provides `DATABASE_URL`).

### 6. Replace `docker-compose.yml`

The user wants a compose with the app + a Postgres service as a **local-dev example**. They'll deploy to Coolify which provides its own managed Postgres via `DATABASE_URL`. Sketch:

```yaml
name: diversif-local

services:
  app:
    build: .
    ports: ['3000:3000']
    environment:
      ORIGIN: http://localhost:3000
      DATABASE_URL: postgres://diversif:diversif@postgres:5432/diversif
      NODE_ENV: development
    depends_on:
      postgres: { condition: service_healthy }

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: diversif
      POSTGRES_PASSWORD: diversif
      POSTGRES_DB: diversif
    volumes:
      - data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U diversif']
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  data:
```

### 7. Env: `.env.example` and any docs that mention `DATABASE_PATH`

Replace `DATABASE_PATH=./data/diversif.db` with `DATABASE_URL=postgres://...`. Coolify's "Database" link feature injects `DATABASE_URL` automatically; the app code already reads it from env.

## How to verify done

1. `npm run check` — typecheck clean.
2. `npm run lint` — clean.
3. `npm run test:coverage` — all tests pass, 100% coverage threshold holds. (Some tests may have been deleted along with backup/migration; that's expected. Don't add tests that exist only to pad coverage.)
4. Spin up the local compose and smoke-test: signup, log a food, confirm migrations ran.
5. Commit incrementally on the branch (one commit per layer: lib, routes, tests, infra) so the diff is reviewable.

## Things to not do

- Don't reintroduce sync DB code anywhere (no `node:fs` writes during requests, no `process.exit` in startup paths).
- Don't preserve any SQLite pragmas or WAL config — Postgres has its own concurrency model.
- Don't add a backup module — Coolify handles managed-DB backups.
- Don't try to support both SQLite and Postgres simultaneously. The user explicitly chose clean slate.
- Don't write a separate migration to seed the Tofu age fix from PR #54 — the new schema seed already has it at 36.

## Final commit message convention

Single squash-merge candidate when done:

```
Migrate from SQLite to Postgres

- Drop better-sqlite3, add pg + pg-mem (test)
- Schema rewritten in pg-core; serial PKs, boolean, timestamp tz
- All DB calls awaited; transactions use async callbacks
- Fresh drizzle/0000_init.sql; old SQLite migrations dropped
- pg-mem-based test DB factory replaces in-memory SQLite
- Dockerfile no longer needs native compile toolchain
- docker-compose.yml is now a local-dev example (app + postgres)
- DATABASE_URL replaces DATABASE_PATH; Coolify provides this automatically
```

When the branch is ready, open a PR against `main`. CI will run; once green, merge.

---

**End of brief.** The WIP commit on `worktree-postgres-migration` is your starting point.

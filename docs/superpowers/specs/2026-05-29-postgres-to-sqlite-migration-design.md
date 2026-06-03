# diversif: Postgres → SQLite migration (on the Bun stack)

**Date:** 2026-05-29
**Branch:** `migrate/bun-sqlite` (off `bun-migration`)
**Status:** approved design → implementation

## Goal

Drop Postgres for SQLite ("Postgres is overkill"). Deliver (1) a **full data
migration** of the live prod data so existing **credentials keep working**
(passwords, passkeys, live sessions), and (2) a **working Railpack deployment**
on Coolify.

## Context (verified)

- App: SvelteKit + **Bun**, Drizzle ORM, deployed on Coolify via **Railpack**
  into CT 103.
- **Prod (main) is still the Node + Postgres stack** (`adapter-node`, `node
build`, `pg`). The entire Bun migration is finished but **un-deployed** on
  `bun-migration` (23 commits ahead of main). This work bases on `bun-migration`,
  so the eventual cutover ships **Bun + SQLite together** to main — one
  modernizing cutover.
- Live DB: Coolify-managed Postgres 18.3 on CT 103
  (`vglvq6fht7yhwun3j2snyv9x`), ~8.6 MB, 12 tables. Tiny data: 2 users,
  1 passkey, 2 sessions, 2 children, 16 food entries, 103 seed foods, etc.
  A second `diversif-database-preview` PG (`lnio6hi1...`) also exists.
- Git history has the original SQLite version (`4c97be1 "Migrate from SQLite to
Postgres"`, which used `better-sqlite3`); `4c97be1^` is the per-file reference
  for the SQLite idioms — re-applied onto the current, since-evolved code.

## Decisions (confirmed with operator)

1. **Driver:** Bun-native `bun:sqlite` + `drizzle-orm/bun-sqlite` (sync; zero new
   deps; mirrors today's `bun:sql`).
2. **Tests:** full migration — `src/test/db.ts` PGlite → `bun:sqlite` `:memory:`;
   port all PG-specific tests. Suite then runs on the **same engine as prod**.
3. **Postgres EOL:** after verify — final `pg_dump` → R2, stop the container
   (rollback window), delete after a few days; switch the backup script to a
   SQLite `VACUUM INTO` snapshot.

## Design

### Schema (`schema.ts`: `drizzle-orm/pg-core` → `drizzle-orm/sqlite-core`)

- `serial().primaryKey()` → `integer().primaryKey({ autoIncrement: true })`
- `timestamp({withTimezone,mode:'date'})` → `integer({mode:'timestamp_ms'})`
  (Drizzle still hands app code `Date`). `symptoms.createdAt.defaultNow()` →
  `.default(sql\`(unixepoch() \* 1000)\`)`.
- `boolean` (`is_major_allergen`, `is_custom`, `backed_up`) →
  `integer({mode:'boolean'})`
- `jsonb('transports') default '[]'::jsonb` → `text({mode:'json'})` default `'[]'`
- partial unique index predicate `is_custom = false` → `= 0`
- `check()`, composite `primaryKey`, FK `onDelete` cascade/set null/restrict,
  `index`/`uniqueIndex` — all carry over to sqlite-core.

### Migrations

`drizzle.config.ts` dialect `sqlite`; delete the 7 PG `drizzle/*.sql` + meta;
regenerate one squashed `0000_init.sql`. Applied on boot by the bun-sqlite
migrator (sync).

### DB client (`index.ts`)

`new Database(DATABASE_PATH, {create:true})` → `drizzle(...)` →
`migrate(...)` (sync) → `seedFoods(...)`. Pragmas on open:
`journal_mode=WAL; foreign_keys=ON; busy_timeout=5000; synchronous=NORMAL`.
Drop pool / `PGPOOL_MAX` / `statement_timeout`. Build-stub path uses `:memory:`
under `building`. Shutdown closes the handle (`sqlite.close()`); the no-pool
change simplifies `shutdown.ts` + its drain tests.

### errors / exec / healthz

- `isUniqueViolation` → recognize `SQLITE_CONSTRAINT_UNIQUE` / "UNIQUE
  constraint failed".
- `exec.ts execRows` → `db.all()` (bun-sqlite has no `.execute()`).
- `healthz` `db.execute(SELECT 1)` → `db.get(...)`.

### Test harness (`src/test/db.ts`)

`bun:sqlite` `:memory:` + `foreign_keys=ON` + apply migrations. `resetTestDb()`:
delete-in-FK-order + reset `sqlite_sequence` (no `TRUNCATE … RESTART IDENTITY
CASCADE`).

### Port dialect-specific app code (guided by `4c97be1^`)

- `seed.ts` — drop `pg_advisory_xact_lock(hashtext(...))`; rely on SQLite
  single-writer + `onConflictDoNothing()` in a tx + the partial unique index.
- `idempotency.ts` — unique-violation flow → `SQLITE_CONSTRAINT_UNIQUE`.
- `passkeys.ts` — `DELETE … RETURNING` (SQLite ≥3.35, drizzle `.returning()`).
- `guidance/queries/{diversity,timeline,seasonal,dismissals}.ts` — strip
  `::int`/`::text`; `FLOOR(EXTRACT(EPOCH FROM givenAt)/N)` simplifies to integer
  math (givenAt is integer-ms now); `onConflictDoUpdate` carries over.
- `gdpr.ts`, `auth.ts`, `cleanup.ts`, `hooks.server.ts`, `account/export`,
  `symptoms.ts`, route count casts — small cast/timestamp fixes.

### Data migration (`scripts/migrate-pg-to-sqlite.ts`)

ETL via Drizzle so types round-trip: read each table from live PG in FK order,
transform (timestamptz→Date→ms, jsonb→json, bool→0/1), insert into a fresh
migrated SQLite **preserving IDs**, bump `sqlite_sequence` to each table's
max(id). **Verify per-table row counts; abort on mismatch.** Passwords,
passkeys and sessions migrate verbatim; RP ID (`diversif.app`) unchanged →
logins keep working.

### Deployment (Coolify → CT 103, Railpack kept)

Persistent volume → container `/app/data` (mirrors garde-manger);
`DATABASE_PATH=/app/data/diversif.db`; remove `DATABASE_URL`/`PGPOOL_MAX`;
unlink managed-PG injection. Place the migrated `diversif.db` in the volume
before the new revision boots (its `__drizzle_migrations` is populated → boot
migrate no-ops). `startCommand` stays `bun build/index.js`. Update
`.env.example`, `Dockerfile`, `docker-compose.yml`, `README`.

### Cutover / rollback / backups

1. Fresh `pg_dump` → R2. 2. Quiesce app, ETL on final PG state, drop
   `diversif.db` in volume, flip env, redeploy via Railpack. 3. Verify
   `/healthz`→`{ok:true}`, login (passkey + existing session), data present.
2. Rollback = restore old env + start PG. 5. After a few days: delete PG (+
   preview); switch `host/sbin/app-db-backups` diversif block to SQLite `VACUUM
INTO`.

**The prod merge/cutover (to main) requires explicit operator go.**

## Risks

- Big-bang cutover ships the un-deployed Bun migration + SQLite together.
  Mitigated by: tiny app/2 users, full green test suite on the same engine,
  fresh pg_dump, and a stop-don't-delete PG rollback window.
- Raw PG SQL porting (guidance queries, seed, idempotency) — bounded list,
  each with `4c97be1^` as reference and tests as the gate.

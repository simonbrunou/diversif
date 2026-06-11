---
name: migration
description: Create and apply a Drizzle schema migration for diversif (bun:sqlite). Use when adding or changing a table or column. Invoked as /migration.
disable-model-invocation: true
---

# Drizzle migration workflow

diversif uses **Drizzle + drizzle-kit** against **SQLite** (`dialect: 'sqlite'`, db at `DATABASE_PATH ?? ./local.db`). Schema lives in `src/lib/server/db/schema.ts`; generated SQL lands in `drizzle/`. Migrations are applied automatically by `migrate()` on server boot (`src/lib/server/db/index.ts`) and in the in-memory test harness — so **committing the `drizzle/` files is what ships the change** (there is no `db:migrate` script).

Run these in order — do not skip the review step.

## 1. Edit the schema

Change `src/lib/server/db/schema.ts`. Match the existing style: snake_case columns, explicit `references()` for FKs, `notNull()` where appropriate, and an `updated_at` column where the table uses last-write-wins.

## 2. Generate the migration

```bash
bun run db:generate
```

Writes a new numbered `drizzle/NNNN_*.sql` and updates `drizzle/meta/`.

## 3. Review the generated SQL — REQUIRED

Read the new `drizzle/NNNN_*.sql`. SQLite has sharp edges:

- **No `ALTER COLUMN`** — type/constraint changes become a table-rebuild (`__new_*` create → copy → drop → rename). Confirm the data-copy step preserves every row.
- A new `NOT NULL` column **without a default** fails on a non-empty table — add a default or backfill (see migration `0001` for the backfill pattern).
- Renames generated as drop+add **lose data** — if you intended a rename, fix the SQL by hand.
- Check FK `on delete` actions match intent (diversif relies on real cascade delete for GDPR).

If the SQL is wrong, fix the schema and regenerate (delete the bad `drizzle/NNNN_*.sql` and its `meta` entry first) rather than hand-patching.

## 4. Verify

- `bun test src/lib/server/db` — the in-memory harness applies every migration; this confirms they're clean and idempotent.
- For a throwaway dev sync without a migration file, `bun run db:push` (dev only — never commit a pushed schema without the generated migration).

## Commit

Commit `schema.ts`, the new `drizzle/NNNN_*.sql`, and the `drizzle/meta/` changes **together**.

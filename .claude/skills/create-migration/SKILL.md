---
name: create-migration
description: >-
  Create a Drizzle schema migration the safe way for this repo — generate from schema.ts, review
  the SQL, apply, and verify the backup. Use when adding or changing a database table/column.
disable-model-invocation: true
---

# create-migration

Walk a Drizzle (SQLite/`bun:sqlite`) schema change through this repo's required flow. Migrations
here are **immutable once generated** — they're applied in order and tracked in `drizzle/meta/`, so
you never hand-edit an existing one (the `block-applied-migration-edit` hook enforces this).

## Steps

1. **Edit the schema** — make the change in `src/lib/server/db/schema.ts` only.
   Keep tenant scoping in mind: child-owned tables need a `childId` (and the index to query it).

2. **Generate** the migration:
   ```bash
   bun db:generate
   ```
   drizzle-kit writes a new `drizzle/NNNN_*.sql` + updates `drizzle/meta/_journal.json`.

3. **Review the generated SQL** before applying. Confirm:
   - It matches your intent (no accidental `DROP`/rename of an unrelated column).
   - SQLite caveats handled: adding a `NOT NULL` column needs a `DEFAULT` or a multi-step migration;
     column renames/drops may be emitted as table-rebuilds — check data is preserved.
   - New foreign keys / indexes for any `childId`/`householdId` you added.

4. **Apply**:
   ```bash
   bun db:push
   ```

5. **Verify the backup path still works** (this repo gates on it):
   ```bash
   bun db:verify-backup
   ```

6. **Test + lint**, then commit (hooks run prettier/eslint; do NOT use `--no-verify`):
   ```bash
   bun test && bun lint
   ```

## If a just-generated migration is wrong
It hasn't been applied/shared yet → delete the `drizzle/NNNN_*.sql` file AND revert its
`drizzle/meta/_journal.json` entry, fix `schema.ts`, and re-run `bun db:generate`. Never edit the
SQL in place.

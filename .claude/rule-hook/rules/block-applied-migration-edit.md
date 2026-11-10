---
name: block-applied-migration-edit
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: drizzle/[0-9].*\.sql$|drizzle/meta/.*\.json$
---

🚫 **Don't hand-edit an applied Drizzle migration**

Files under `drizzle/` (the numbered `*.sql` migrations and `meta/_journal.json`)
are immutable history. Editing one desyncs the database from the migration
journal: anyone who already ran it keeps the old schema, and `drizzle-kit` won't
re-apply a changed file. This is how "works on my machine" schema drift happens.

**To change the schema:**
1. Edit `src/lib/server/db/schema.ts`.
2. Run `bun db:generate` — drizzle-kit writes a NEW migration (not blocked; it's
   a generated file, not a hand edit).
3. Review the generated SQL, then `bun db:push`, then `bun db:verify-backup`.

If you genuinely need to fix a bad migration that has NOT been applied or shared
yet, delete it + its journal entry and regenerate — don't edit it in place.

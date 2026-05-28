import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';

type DB = PgliteDatabase<typeof schema>;

// One in-process PGlite instance per test run. PGlite has real Postgres
// semantics (DO $$ blocks, SAVEPOINT, ALTER COLUMN … USING, CHECK on NULL,
// hashtext, pg_advisory_xact_lock, FLOOR over float), which means the
// migrations folder applies verbatim — no rewrites, no shims, no per-bug
// workarounds the pg-mem harness used to need.
const pglite = new PGlite();
const testDb: DB = drizzle(pglite, { schema });

async function applyMigrations(): Promise<void> {
  const migrationsDir = path.resolve('./drizzle');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8');
    // drizzle-kit emits `--> statement-breakpoint` between statements; PGlite
    // executes one SQL statement per .exec() call.
    for (const stmt of sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await pglite.exec(stmt);
    }
  }
}

await applyMigrations();

const TRUNCATE_ORDER = [
  'tip_dismissals',
  'symptoms',
  'food_entries',
  'invitations',
  'memberships',
  'webauthn_challenges',
  'passkeys',
  'sessions',
  'idempotency_keys',
  'children',
  'users',
  'foods'
];

// TRUNCATE … RESTART IDENTITY CASCADE is real Postgres and PGlite supports
// it directly. Single statement vs the per-table DELETE loop the pg-mem
// harness needed; also resets sequences cleanly (pg-mem's sequence naming
// diverged from real PG, which made ALTER SEQUENCE … RESTART unusable).
export async function resetTestDb(): Promise<void> {
  await testDb.execute(
    sql.raw(
      `TRUNCATE TABLE ${TRUNCATE_ORDER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`
    )
  );
}

export { testDb, schema };

import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '$lib/server/db/schema';

type DB = BunSQLiteDatabase<typeof schema>;

// One in-process bun:sqlite database per test run — the SAME engine as prod,
// so the migrations folder applies verbatim and there are no dialect-emulation
// gaps (the PGlite harness this replaced emulated Postgres semantics the prod
// driver no longer uses). foreign_keys must be enabled per-connection for the
// ON DELETE actions in schema.ts to fire.
const sqlite = new Database(':memory:');
sqlite.exec('PRAGMA foreign_keys = ON;');
const testDb: DB = drizzle(sqlite, { schema });

function applyMigrations(): void {
  const migrationsDir = path.resolve('./drizzle');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(path.join(migrationsDir, file), 'utf8');
    // drizzle-kit emits `--> statement-breakpoint` between statements; run them
    // one at a time so multi-statement migration files apply cleanly.
    for (const stmt of sqlText
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)) {
      sqlite.exec(stmt);
    }
  }
}

applyMigrations();

// Child → parent order so the deletes satisfy foreign keys regardless of
// cascade configuration.
const TRUNCATE_ORDER = [
  'tip_dismissals',
  'symptoms',
  'prepared_meals',
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

// SQLite has no `TRUNCATE … RESTART IDENTITY CASCADE`. Delete every table in FK
// order, then clear sqlite_sequence so AUTOINCREMENT ids restart at 1 —
// matching the identity reset the PGlite harness gave for free.
export async function resetTestDb(): Promise<void> {
  sqlite.transaction(() => {
    for (const table of TRUNCATE_ORDER) {
      sqlite.exec(`DELETE FROM "${table}";`);
    }
    sqlite.exec('DELETE FROM sqlite_sequence;');
  })();
}

export { testDb, schema };

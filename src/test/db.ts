import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '$lib/server/db/schema';

type DB = BetterSQLite3Database<typeof schema>;

const sqlite = new Database(':memory:');
// FK enforcement must be off while migrate() runs (see src/lib/server/db/index.ts
// for why). Re-enable after migrations so the test suite still exercises FKs.
sqlite.pragma('foreign_keys = OFF');

export const testDb: DB = drizzle(sqlite, { schema });

migrate(testDb as unknown as BetterSQLite3Database, {
  migrationsFolder: path.resolve('./drizzle')
});

// Mirror production: PRAGMA foreign_keys = ON does NOT retroactively validate
// existing rows, so a future migration could leave orphans, every test would
// still pass, and production startup would crash on the first foreign_key_check.
// Run the same check here as src/lib/server/db/index.ts so the suite catches
// data-loss-shaped migrations before they ship.
const violations = sqlite.pragma('foreign_key_check') as unknown[];
if (Array.isArray(violations) && violations.length > 0) {
  throw new Error(`Foreign key violations after migrations: ${JSON.stringify(violations)}`);
}

sqlite.pragma('foreign_keys = ON');

export function resetTestDb(): void {
  // Order respects foreign-key dependencies.
  sqlite.exec(`
    DELETE FROM tip_dismissals;
    DELETE FROM food_entries;
    DELETE FROM invitations;
    DELETE FROM memberships;
    DELETE FROM webauthn_challenges;
    DELETE FROM passkeys;
    DELETE FROM sessions;
    DELETE FROM children;
    DELETE FROM users;
    DELETE FROM foods;
  `);
}

export { schema };

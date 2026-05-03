import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '$lib/server/db/schema';

type DB = BetterSQLite3Database<typeof schema>;

const sqlite = new Database(':memory:');
sqlite.pragma('foreign_keys = ON');

export const testDb: DB = drizzle(sqlite, { schema });

migrate(testDb as unknown as BetterSQLite3Database, {
  migrationsFolder: path.resolve('./drizzle')
});

export function resetTestDb(): void {
  // Order respects foreign-key dependencies.
  sqlite.exec(`
    DELETE FROM tip_dismissals;
    DELETE FROM food_entries;
    DELETE FROM invitations;
    DELETE FROM memberships;
    DELETE FROM sessions;
    DELETE FROM children;
    DELETE FROM users;
    DELETE FROM foods;
  `);
}

export { schema };

import path from 'node:path';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';
import { backupBeforeMigrate } from './backup';

type DB = BetterSQLite3Database<typeof schema>;

let _db: DB | null = null;

function resolveDbPath(): string {
  const p = process.env.DATABASE_PATH ?? './data/diversif.db';
  return path.resolve(p);
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
}

export function getDb(): DB {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  ensureDir(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  // Best-effort: skip the snapshot when the DB file is brand new (size 0)
  // or when the existence/size probe itself fails (race against another
  // process, permission error). A backup is a safety net — it must never
  // abort startup.
  let shouldBackup = false;
  try {
    shouldBackup = existsSync(dbPath) && statSync(dbPath).size > 0;
  } catch (err) {
    console.warn('[db] could not probe DB file for pre-migration backup:', err);
  }
  if (shouldBackup) {
    backupBeforeMigrate(sqlite, dbPath);
  }

  // Foreign keys MUST be off while migrations run. Drizzle wraps each migration
  // in BEGIN/COMMIT, and SQLite documents `PRAGMA foreign_keys` as a silent
  // no-op inside a transaction. Migrations that use the table-rebuild pattern
  // to change a FK clause start with `PRAGMA foreign_keys=OFF;`, but inside
  // the wrapping transaction that PRAGMA is ignored — so `DROP TABLE old`
  // fires an implicit DELETE that cascades through dependent rows. That is
  // what wiped memberships / food_entries / invitations during the GDPR
  // migration (0003). Setting the pragma here, before migrate() opens its
  // transaction, makes the off/on toggling actually take effect.
  sqlite.pragma('foreign_keys = OFF');

  _db = drizzle(sqlite, { schema });

  const migrationsFolder = path.resolve('./drizzle');
  migrate(_db as unknown as BetterSQLite3Database, { migrationsFolder });

  const violations = sqlite.pragma('foreign_key_check') as unknown[];
  if (Array.isArray(violations) && violations.length > 0) {
    throw new Error(`Foreign key violations after migrations: ${JSON.stringify(violations)}`);
  }
  sqlite.pragma('foreign_keys = ON');

  seedFoods(_db);

  return _db;
}

export const db = getDb();
export { schema };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  // Imported lazily to avoid a circular import at module init.
  void import('../cleanup').then(({ startCleanupTimer }) => startCleanupTimer());
}

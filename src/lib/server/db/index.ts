import path from 'node:path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';

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

const BACKUP_KEEP = Math.max(1, Number(process.env.DB_BACKUP_KEEP ?? '10'));

export function backupBeforeMigrate(sqlite: Database.Database, dbPath: string): string | null {
  // Online snapshot of the DB before migrations run, so a destructive migration
  // can never silently lose data — the operator can always roll back.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const target = path.join(backupDir, `${path.basename(dbPath, '.db')}-${stamp}.db`);
  try {
    sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } catch (err) {
    console.error('[db] pre-migration backup failed:', err);
    return null;
  }

  const snapshots = readdirSync(backupDir)
    .filter((f) => f.startsWith(`${path.basename(dbPath, '.db')}-`) && f.endsWith('.db'))
    .map((f) => ({ f, t: statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of snapshots.slice(BACKUP_KEEP)) {
    try {
      unlinkSync(path.join(backupDir, old.f));
    } catch {
      // best-effort rotation, ignore
    }
  }
  return target;
}

export function getDb(): DB {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  ensureDir(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');

  if (existsSync(dbPath) && statSync(dbPath).size > 0) {
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

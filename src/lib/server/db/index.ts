import path from 'node:path';
import { mkdirSync } from 'node:fs';
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

export function getDb(): DB {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  ensureDir(dbPath);

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  _db = drizzle(sqlite, { schema });

  const migrationsFolder = path.resolve('./drizzle');
  migrate(_db as unknown as BetterSQLite3Database, { migrationsFolder });
  seedFoods(_db);

  return _db;
}

export const db = getDb();
export { schema };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  // Imported lazily to avoid a circular import at module init.
  void import('../cleanup').then(({ startCleanupTimer }) => startCleanupTimer());
}

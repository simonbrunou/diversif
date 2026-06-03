// Side-effect-only: ensures Sentry is initialised before this module runs
// migrations. captureException below would otherwise silently drop events
// because hooks.server.ts's own Sentry.init has not run yet at that point in
// the import chain.
import '$lib/sentry-init.server';

import path from 'node:path';
import * as Sentry from '@sentry/sveltekit';
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';
import { registerShutdownHandlers } from '../shutdown';
import { building } from '$app/environment';

export type DB = BunSQLiteDatabase<typeof schema>;

function resolveDatabasePath(): string {
  // Vite's SSR/prerender pass imports server modules at build time. migrate()
  // and seedFoods() are gated by `building`, but the Database constructor still
  // opens a handle, so use an in-memory DB during build. This keeps
  // DATABASE_PATH out of the build environment (Railpack, Docker without a
  // mounted volume, plain `bun run build`). It is never migrated or queried —
  // `building` short-circuits everything downstream.
  if (building) return ':memory:';
  const dbPath = process.env.DATABASE_PATH;
  if (!dbPath) {
    throw new Error('DATABASE_PATH is required (e.g. /app/data/diversif.db)');
  }
  return dbPath;
}

const sqlite = new Database(resolveDatabasePath(), { create: true });
// Connection pragmas (this process holds a single SQLite connection, unlike
// the prior pg pool):
//   - journal_mode=WAL: readers never block the single writer; durable.
//   - foreign_keys=ON: REQUIRED for the ON DELETE CASCADE / SET NULL / RESTRICT
//     actions in schema.ts to fire (SQLite leaves this OFF per-connection).
//   - busy_timeout: wait (don't throw SQLITE_BUSY) when the writer is briefly
//     held — e.g. a rolling-deploy overlap or the seed transaction.
//   - synchronous=NORMAL: safe under WAL, far fewer fsyncs than FULL.
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');
sqlite.exec('PRAGMA busy_timeout = 5000;');
sqlite.exec('PRAGMA synchronous = NORMAL;');

const drizzleDb = drizzle(sqlite, { schema });

// bun:sqlite is synchronous, so — unlike the prior Postgres bootstrap — there
// is no top-level await here: migrate() + seedFoods() run to completion as the
// module evaluates. Skip during `vite build`: the SSR/prerender pass imports
// server modules to render pages, which would otherwise fire migrate()/seed
// against the :memory: stub. `building` is true only during `vite build`.
if (!building) {
  try {
    const migrationsFolder = path.resolve('./drizzle');
    migrate(drizzleDb, { migrationsFolder });
    seedFoods(drizzleDb);
  } catch (err) {
    Sentry.captureException(err, { tags: { subsystem: 'db-migrate' } });
    throw err;
  }
}

export const db = drizzleDb;
export { schema };
// Exported as `pool` for symmetry with the prior pg.Pool / Bun.SQL export. The
// shutdown handler only needs to close the handle; bun:sqlite's close() is
// synchronous, so we wrap it in the EndablePool `{ end }` shape it expects.
export const pool = { end: async () => sqlite.close() };

if (!building && process.env.NODE_ENV !== 'test' && !process.env.BUN_TEST) {
  // Register the SIGTERM handler synchronously: a fire-and-forget dynamic
  // import would lose the signal if SIGTERM arrived during the startup window
  // before the .then() callback ran (e.g. Coolify replacing a revision within
  // seconds of boot). Cleanup stays dynamic to avoid pulling its setInterval
  // into test envs; beforeExit captures stopCleanupTimer once the module loads.
  let stopCleanupTimer: (() => void) | null = null;
  void import('../cleanup').then((mod) => {
    stopCleanupTimer = mod.stopCleanupTimer;
    mod.startCleanupTimer();
  });
  registerShutdownHandlers({
    pool,
    beforeExit: () => stopCleanupTimer?.(),
    // 2s flush budget mirrors Sentry's own docs for SIGTERM handlers.
    flush: async () => {
      await Sentry.close(2000);
    }
  });
}

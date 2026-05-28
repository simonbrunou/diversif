// Side-effect-only: ensures Sentry is initialised before this module's
// top-level await runs migrations. captureException below would otherwise
// silently drop events because hooks.server.ts's own Sentry.init has not
// run yet at that point in the import chain.
import '$lib/sentry-init.server';

import path from 'node:path';
import * as Sentry from '@sentry/sveltekit';
import { SQL } from 'bun';
import { drizzle, type BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';
import { registerShutdownHandlers } from '../shutdown';
import { building } from '$app/environment';

export type DB = BunSQLDatabase<typeof schema>;

function resolveDatabaseUrl(): string {
  // Vite's SSR prerender imports server modules at build time. bun:sql is
  // lazy (no connection until first query) and the migrate()/seedFoods()
  // calls below are already gated by `building`, but the SQL constructor
  // still reads this URL to validate the shape. Returning a build-time
  // stub avoids requiring DATABASE_URL in the build environment (Railpack,
  // Docker without --build-arg, plain `bun run build` for dev sanity).
  // The stub is never connected to — `building` short-circuits everything
  // downstream.
  if (building) return 'postgres://build-stub@127.0.0.1:5432/build';
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  }
  return url;
}

function resolvePoolMax(): number {
  const raw = process.env.PGPOOL_MAX;
  /* v8 ignore next : defensive for invalid env input, no test env sets PGPOOL_MAX */
  if (!raw) return 10;
  const n = Number(raw);
  /* v8 ignore next : defensive for invalid env input */
  if (!Number.isInteger(n) || n <= 0) return 10;
  return n;
}

// Bun.SQL pools internally. Defaults are similar in spirit to pg.Pool's, but
// we override them for the same reasons as before:
//   - connectionTimeout: bound how long an acquire can wait. A saturated pool
//     should fail fast so /healthz stays responsive (Docker HEALTHCHECK relies
//     on it).
//   - idleTimeout: 30s avoids churn under sustained load.
//   - connection.statement_timeout: applied as a Postgres runtime parameter on
//     every new connection. A runaway query fails fast instead of holding a
//     worker until the OS kills the socket.
// PGPOOL_MAX lets self-hosters scale concurrent connections to their PG
// server's max_connections budget.
const sqlClient = new SQL({
  url: resolveDatabaseUrl(),
  max: resolvePoolMax(),
  idleTimeout: 30,
  connectionTimeout: 5,
  connection: {
    statement_timeout: 10_000
  }
});
const drizzleDb = drizzle(sqlClient, { schema });

// Top-level await: SvelteKit's adapter runs as ESM, so importing this
// module blocks on migration + seed at runtime. After the import settles,
// `db` is a connected, migrated, seeded handle.
//
// Skip during `vite build` — the SSR/prerender pass imports server modules
// to render pages, which fires this top-level await. The build container
// cannot reach the runtime postgres hostname, so the migrate() call would
// fail with ENOTFOUND. `building` is true only during `vite build`; false
// at server start and in tests.
if (!building) {
  try {
    const migrationsFolder = path.resolve('./drizzle');
    await migrate(drizzleDb, { migrationsFolder });
    await seedFoods(drizzleDb);
  } catch (err) {
    Sentry.captureException(err, { tags: { subsystem: 'db-migrate' } });
    throw err;
  }
}

export const db = drizzleDb;
export { schema };
// Exported as `pool` for symmetry with the prior pg.Pool export — the
// shutdown handler only uses .end() so the rename would be churn without
// changing semantics.
export { sqlClient as pool };

if (!building && process.env.NODE_ENV !== 'test' && !process.env.BUN_TEST) {
  // Register the SIGTERM handler synchronously: a fire-and-forget dynamic
  // import would lose the signal if SIGTERM arrived during the startup
  // window before the .then() callback ran (e.g. Coolify replacing a
  // revision within seconds of boot), defeating the entire purpose.
  // Cleanup stays dynamic to avoid pulling its setInterval into test envs;
  // beforeExit captures stopCleanupTimer once the module loads.
  let stopCleanupTimer: (() => void) | null = null;
  void import('../cleanup').then((mod) => {
    stopCleanupTimer = mod.stopCleanupTimer;
    mod.startCleanupTimer();
  });
  registerShutdownHandlers({
    pool: sqlClient,
    beforeExit: () => stopCleanupTimer?.(),
    // 2s flush budget mirrors Sentry's own docs for SIGTERM handlers. Long
    // enough to drain the buffer over a healthy connection; short enough
    // that a wedged Sentry endpoint doesn't outlive the orchestrator's
    // shutdown grace period.
    flush: async () => {
      await Sentry.close(2000);
    }
  });
}

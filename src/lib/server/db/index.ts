// Side-effect-only: ensures Sentry is initialised before this module's
// top-level await runs migrations. captureException below would otherwise
// silently drop events because hooks.server.ts's own Sentry.init has not
// run yet at that point in the import chain.
import '$lib/sentry-init.server';

import path from 'node:path';
import * as Sentry from '@sentry/sveltekit';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './schema';
import { seedFoods } from './seed';
import { registerShutdownHandlers } from '../shutdown';

export type DB = NodePgDatabase<typeof schema>;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  }
  return url;
}

function resolvePoolMax(): number {
  const raw = process.env.PGPOOL_MAX;
  /* v8 ignore next — defensive for invalid env input, no test env sets PGPOOL_MAX */
  if (!raw) return 10;
  const n = Number(raw);
  /* v8 ignore next — defensive for invalid env input */
  if (!Number.isInteger(n) || n <= 0) return 10;
  return n;
}

// Pool defaults are dangerous for a single-process Node app:
//   - connectionTimeoutMillis: 0 means acquires wait forever, so a saturated
//     pool wedges every incoming request including /healthz, defeating the
//     Docker HEALTHCHECK that's meant to detect a wedged DB.
//   - idleTimeoutMillis: 10s churns connections under sustained load.
//   - no statement_timeout means a single runaway query holds a worker until
//     the OS kills the connection.
// Override all four so failures fail fast and surface as 5xx instead of
// hangs. PGPOOL_MAX lets self-hosters scale the pool to their pg server.
const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: resolvePoolMax(),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000
});
const drizzleDb = drizzle(pool, { schema });

// Top-level await: SvelteKit's Node adapter runs as ESM, so importing this
// module blocks on migration + seed. After the import settles, `db` is a
// connected, migrated, seeded handle.
try {
  const migrationsFolder = path.resolve('./drizzle');
  await migrate(drizzleDb, { migrationsFolder });
  await seedFoods(drizzleDb);
} catch (err) {
  Sentry.captureException(err, { tags: { subsystem: 'db-migrate' } });
  throw err;
}

export const db = drizzleDb;
export { schema };
export { pool };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
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
    pool,
    beforeExit: () => stopCleanupTimer?.()
  });
}

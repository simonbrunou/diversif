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

export type DB = NodePgDatabase<typeof schema>;

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  }
  return url;
}

const pool = new Pool({ connectionString: resolveDatabaseUrl() });
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
  void import('../cleanup').then(({ startCleanupTimer }) => startCleanupTimer());
}

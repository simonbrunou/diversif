// Smoke test for the prod-db bootstrap module. The bunfig preload globally
// mocks the `$lib/server/db` alias to redirect every transitive import to
// the PGlite test handle — which means no test in the suite actually
// exercises `src/lib/server/db/index.ts` itself, so a syntax error or a
// broken top-level await in that file would ship to prod undetected.
//
// We bypass the alias mock by importing via the RELATIVE path `./index`
// (bun:test's mock.module is keyed by module specifier; only the
// `$lib/server/db` alias is registered, so `./index` resolves to the real
// file). We also re-mock `$app/environment` with `building: true` BEFORE
// the dynamic import so the top-level await migrate() is skipped — no real
// Postgres is required to load the module.
import { describe, expect, it, mock } from 'bun:test';
import * as schemaNs from './schema';

describe('src/lib/server/db/index.ts (prod-db bootstrap smoke)', () => {
  it('loads without throwing and exports db, schema, pool', async () => {
    // No DATABASE_PATH needed: with building=true the module opens an in-memory
    // SQLite handle and skips migrate()/seed entirely.

    // Re-register $app/environment with building=true so the
    // `if (!building)` migrate/seed block is skipped. The preload defaults
    // to building=false; the LAST mock.module registration wins.
    mock.module('$app/environment', () => ({
      browser: false,
      building: true,
      dev: true,
      version: 'test'
    }));

    const prodDb = await import('./index');

    expect(prodDb.db).toBeDefined();
    expect(typeof prodDb.db).toBe('object');
    expect(prodDb.schema).toBe(schemaNs);
    expect(prodDb.pool).toBeDefined();
    expect(typeof prodDb.pool.end).toBe('function');
  });
});

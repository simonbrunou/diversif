import path from 'node:path';
import { readFileSync } from 'node:fs';
import { newDb, DataType, type IMemoryDb } from 'pg-mem';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';

type DB = NodePgDatabase<typeof schema>;

function buildMem(): IMemoryDb {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  // pg-mem ships a small subset of pg builtins. Register the ones our SQL uses
  // that aren't included by default.
  mem.public.registerFunction({
    name: 'now',
    returns: DataType.timestamptz,
    implementation: () => new Date()
  });
  // FLOOR over a float is used by the streak query; pg-mem has no native impl.
  mem.public.registerFunction({
    name: 'floor',
    args: [DataType.float],
    returns: DataType.float,
    implementation: (n: number) => Math.floor(n)
  });
  return mem;
}

function applyMigrations(mem: IMemoryDb): void {
  const initSql = readFileSync(path.resolve('./drizzle/0000_init.sql'), 'utf8');

  // Drizzle wraps each ADD CONSTRAINT in a DO $$ BEGIN ... EXCEPTION WHEN
  // duplicate_object THEN null; END $$; block for idempotency. pg-mem doesn't
  // execute EXCEPTION handlers, but the inner ALTER TABLE statement is plain
  // SQL — strip the wrapper so pg-mem sees a single statement per FK.
  const unwrapped = initSql.replace(
    /DO \$\$ BEGIN\s*([\s\S]*?)\s*EXCEPTION\s+WHEN duplicate_object THEN null;\s*END \$\$;/g,
    '$1'
  );

  for (const stmt of unwrapped
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)) {
    mem.public.none(stmt);
  }
}

const mem = buildMem();
applyMigrations(mem);

const { Pool } = mem.adapters.createPg();
const memPool = new Pool();

// Drizzle's node-postgres session passes config flags pg-mem rejects:
// - `types.getTypeParser` (drizzle wants raw strings to parse itself; pg-mem
//   already returns native JS values — Dates, booleans — that drizzle's column
//   mappers accept verbatim, so we drop the parser).
// - `rowMode: 'array'` (drizzle expects rows as positional arrays for
//   `mapResultRow`; pg-mem only emits object rows). We strip the flag, then
//   convert each row via `Object.values()` after the query — pg-mem fills
//   row objects in SELECT-column order, which is what drizzle expects.
type PgQueryConfig = {
  types?: unknown;
  rowMode?: unknown;
} & Record<string, unknown>;

function wrapClient<T extends { query: (...args: unknown[]) => unknown }>(client: T): T {
  const original = client.query.bind(client);
  client.query = (async (...args: unknown[]) => {
    let arrayMode = false;
    if (args.length > 0 && args[0] && typeof args[0] === 'object') {
      const cfg = args[0] as PgQueryConfig;
      if (cfg.rowMode === 'array') arrayMode = true;
      if (cfg.types !== undefined || cfg.rowMode !== undefined) {
        const { types: _t, rowMode: _r, ...rest } = cfg;
        args[0] = rest;
      }
    }
    const result = (await original(...args)) as { rows?: unknown[] };
    if (arrayMode && Array.isArray(result.rows)) {
      result.rows = result.rows.map((row) =>
        row && typeof row === 'object' ? Object.values(row as Record<string, unknown>) : row
      );
    }
    return result;
  }) as T['query'];
  return client;
}

const wrappedPool = wrapClient(memPool);
const originalConnect = wrappedPool.connect.bind(wrappedPool);
wrappedPool.connect = (async (...args: unknown[]) => {
  const client = await originalConnect(...(args as []));
  return wrapClient(client);
}) as typeof wrappedPool.connect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const testDb: DB = drizzle(wrappedPool as any, { schema });

const TRUNCATE_ORDER = [
  'tip_dismissals',
  'food_entries',
  'invitations',
  'memberships',
  'webauthn_challenges',
  'passkeys',
  'sessions',
  'idempotency_keys',
  'children',
  'users',
  'foods'
];

// Tests share a process-global handle, so resets must be ordered to honor
// foreign-key constraints. DELETE in dependency order avoids the need to
// disable fk enforcement. Sequences keep advancing across tests — that's
// fine for behaviour, and pg-mem's sequence naming differs from real pg
// enough that ALTER SEQUENCE … RESTART would fail.
export async function resetTestDb(): Promise<void> {
  for (const table of TRUNCATE_ORDER) {
    await testDb.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}

export { schema };

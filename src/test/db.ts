import path from 'node:path';
import { readFileSync } from 'node:fs';
import { newDb, DataType, type IBackup, type IMemoryDb } from 'pg-mem';
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
  // hashtext + pg_advisory_xact_lock are used by seedFoods to serialize
  // concurrent boots in production. Tests run single-process, so the lock is
  // safely a no-op; we register typed shims so pg-mem accepts the calls.
  mem.public.registerFunction({
    name: 'hashtext',
    args: [DataType.text],
    returns: DataType.integer,
    implementation: (s: string) => {
      let h = 0;
      for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
      return h;
    }
  });
  mem.public.registerFunction({
    name: 'pg_advisory_xact_lock',
    args: [DataType.integer],
    returns: DataType.null as unknown as DataType,
    implementation: () => null
  });
  return mem;
}

function applyMigrations(mem: IMemoryDb): void {
  // pg-mem only models the initial schema for tests plus migrations that pg-mem
  // can execute; later drizzle migrations (data backfills, partial unique
  // indexes that pg-mem's wrapped-client semantics don't fully simulate) are
  // enforced in production but skipped here. seedFoods + applySeedCorrections
  // idempotently re-establish the same post-migration state in tests.
  const filenames = ['0000_init.sql', '0003_passkeys_transports_jsonb.sql', '0004_symptoms.sql'];

  for (const filename of filenames) {
    const sqlText = readFileSync(path.resolve('./drizzle', filename), 'utf8');

    // Drizzle wraps each ADD CONSTRAINT in a DO $$ BEGIN ... EXCEPTION WHEN
    // duplicate_object THEN null; END $$; block for idempotency. pg-mem doesn't
    // execute EXCEPTION handlers, but the inner ALTER TABLE statement is plain
    // SQL : strip the wrapper so pg-mem sees a single statement per FK.
    let unwrapped = sqlText.replace(
      /DO \$\$ BEGIN\s*([\s\S]*?)\s*EXCEPTION\s+WHEN duplicate_object THEN null;\s*END \$\$;/g,
      '$1'
    );

    // pg-mem doesn't parse `ALTER COLUMN … SET DATA TYPE … USING`. The test DB
    // is empty when migrations run so the cast has no rows to act on; rewrite
    // the type change to DROP+ADD which pg-mem accepts and is equivalent for
    // a freshly-built test schema.
    if (filename === '0003_passkeys_transports_jsonb.sql') {
      unwrapped = `
        ALTER TABLE "passkeys" DROP COLUMN "transports";
        ALTER TABLE "passkeys" ADD COLUMN "transports" jsonb NOT NULL DEFAULT '[]'::jsonb;
      `;
    }

    for (const stmt of unwrapped
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)) {
      mem.public.none(stmt);
    }
  }
}

const mem = buildMem();
applyMigrations(mem);

const { Pool } = mem.adapters.createPg();
const memPool = new Pool();

// Drizzle's node-postgres session passes config flags pg-mem rejects:
// - `types.getTypeParser` (drizzle wants raw strings to parse itself; pg-mem
//   already returns native JS values : Dates, booleans : that drizzle's column
//   mappers accept verbatim, so we drop the parser).
// - `rowMode: 'array'` (drizzle expects rows as positional arrays for
//   `mapResultRow`; pg-mem only emits object rows). We strip the flag, then
//   convert each row via `Object.values()` after the query : pg-mem fills
//   row objects in SELECT-column order, which is what drizzle expects.
type PgQueryConfig = {
  types?: unknown;
  rowMode?: unknown;
} & Record<string, unknown>;

// pg-mem's emulated Pool ignores BEGIN/ROLLBACK semantically : a transaction
// rollback would leave inserted rows behind, breaking any test that exercises
// transactional behaviour. Emulate per-client transactions by snapshotting the
// whole memory db on BEGIN and restoring on ROLLBACK. SAVEPOINT-based nested
// transactions push another snapshot frame; tests don't run concurrently so
// the global mem.backup() semantics are safe.
function wrapClient<T extends { query: (...args: unknown[]) => unknown }>(client: T): T {
  const original = client.query.bind(client);
  const txStack: IBackup[] = [];

  function getSql(args: unknown[]): string {
    if (args.length === 0) return '';
    const arg = args[0];
    if (typeof arg === 'string') return arg;
    if (arg && typeof arg === 'object' && 'text' in arg) {
      const t = (arg as { text: unknown }).text;
      if (typeof t === 'string') return t;
    }
    return '';
  }

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

    const trimmedSql = getSql(args).trim().replace(/;$/, '').toUpperCase();
    // pg-mem's parser rejects `SAVEPOINT sp1` / `RELEASE SAVEPOINT …` /
    // `ROLLBACK TO SAVEPOINT …`, so we handle nested-transaction control
    // statements entirely in the wrapper: track a snapshot stack and short-
    // circuit before pg-mem ever sees the SQL. BEGIN/COMMIT/ROLLBACK are
    // recognised by pg-mem so we still forward those.
    if (trimmedSql.startsWith('SAVEPOINT ')) {
      txStack.push(mem.backup());
      return { rows: [], rowCount: 0, command: 'SAVEPOINT', oid: 0, fields: [] };
    }
    if (trimmedSql.startsWith('RELEASE SAVEPOINT ')) {
      txStack.pop();
      return { rows: [], rowCount: 0, command: 'RELEASE', oid: 0, fields: [] };
    }
    if (trimmedSql.startsWith('ROLLBACK TO SAVEPOINT ')) {
      const snap = txStack.pop();
      if (snap) snap.restore();
      return { rows: [], rowCount: 0, command: 'ROLLBACK', oid: 0, fields: [] };
    }
    if (trimmedSql === 'BEGIN') {
      txStack.push(mem.backup());
    } else if (trimmedSql === 'COMMIT') {
      txStack.pop();
    } else if (trimmedSql === 'ROLLBACK') {
      const snap = txStack.pop();
      if (snap) snap.restore();
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
  'symptoms',
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
// disable fk enforcement. Sequences keep advancing across tests : that's
// fine for behaviour, and pg-mem's sequence naming differs from real pg
// enough that ALTER SEQUENCE … RESTART would fail.
export async function resetTestDb(): Promise<void> {
  for (const table of TRUNCATE_ORDER) {
    await testDb.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}

export { schema };

#!/usr/bin/env bun
/**
 * One-shot data migration: load a Postgres snapshot (one JSON file per table,
 * produced by `psql ... SELECT json_agg(t) FROM <table> t`) into a fresh
 * bun:sqlite database with the current Drizzle schema applied.
 *
 * Why JSON-via-psql rather than a live Bun.SQL connection: the Coolify-managed
 * Postgres on CT103 is only reachable on its container network, so the snapshot
 * is exported through `pct exec 103 -- docker exec <pg> psql` (see the cutover
 * runbook) and copied to this box. JSON loses column types, so the per-column
 * maps below restore them: timestamptz ISO strings -> integer epoch-ms, pg
 * booleans -> 0/1, jsonb -> a JSON text blob.
 *
 * Usage:
 *   bun scripts/migrate-pg-to-sqlite.ts --in <json-dir> --out <db-path>
 *
 * Guarantees: row IDs are preserved verbatim; sqlite_sequence is bumped so new
 * AUTOINCREMENT ids continue past the max; PRAGMA foreign_key_check must pass;
 * per-table row counts must match the source JSON or the script aborts.
 */
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Insert parents before children so the post-load foreign_key_check is meaningful
// even though FKs are disabled during the bulk load.
const TABLES = [
  'users',
  'children',
  'foods',
  'memberships',
  'invitations',
  'food_entries',
  'sessions',
  'passkeys',
  'webauthn_challenges',
  'idempotency_keys',
  'symptoms',
  'tip_dismissals'
] as const;

// Tables with an AUTOINCREMENT integer primary key (serial in Postgres).
const AUTOINC_TABLES = ['users', 'children', 'foods', 'food_entries', 'symptoms'];

// timestamptz columns -> integer epoch-ms.
const TIMESTAMP_COLS: Record<string, string[]> = {
  users: [
    'created_at',
    'tos_accepted_at',
    'privacy_accepted_at',
    'age_confirmed_at',
    'last_login_at',
    'last_export_at'
  ],
  sessions: ['expires_at'],
  children: ['created_at'],
  memberships: ['created_at'],
  invitations: ['created_at', 'expires_at', 'used_at'],
  food_entries: ['given_at', 'created_at'],
  tip_dismissals: ['dismissed_at'],
  passkeys: ['created_at', 'last_used_at'],
  webauthn_challenges: ['expires_at'],
  idempotency_keys: ['created_at'],
  symptoms: ['observed_at', 'created_at']
};
const BOOLEAN_COLS: Record<string, string[]> = {
  foods: ['is_major_allergen', 'is_custom'],
  passkeys: ['backed_up']
};
const JSON_COLS: Record<string, string[]> = {
  passkeys: ['transports']
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const inDir = arg('--in');
const outPath = arg('--out');
if (!inDir || !outPath) {
  console.error('usage: bun scripts/migrate-pg-to-sqlite.ts --in <json-dir> --out <db-path>');
  process.exit(2);
}

function convert(table: string, col: string, value: unknown): number | string | null {
  if (value === null || value === undefined) return null;
  if (TIMESTAMP_COLS[table]?.includes(col)) {
    const ms = new Date(value as string).getTime();
    if (Number.isNaN(ms)) throw new Error(`bad timestamp ${table}.${col}=${String(value)}`);
    return ms;
  }
  if (BOOLEAN_COLS[table]?.includes(col)) return value ? 1 : 0;
  if (JSON_COLS[table]?.includes(col)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value); // defensive
  return value as number | string;
}

const sqlite = new Database(outPath, { create: true });
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = OFF;'); // bulk load; validated at the end
const db = drizzle(sqlite);
migrate(db, { migrationsFolder: path.resolve('./drizzle') });

const sourceCounts: Record<string, number> = {};

const tx = sqlite.transaction(() => {
  for (const table of TABLES) {
    const file = path.join(inDir, `${table}.json`);
    if (!existsSync(file)) throw new Error(`missing export file: ${file}`);
    const rows = JSON.parse(readFileSync(file, 'utf8')) as Array<Record<string, unknown>>;
    sourceCounts[table] = rows.length;
    if (rows.length === 0) continue;

    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const colList = cols.map((c) => `"${c}"`).join(', ');
    const stmt = sqlite.prepare(`INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`);
    for (const row of rows) {
      stmt.run(...cols.map((c) => convert(table, c, row[c])));
    }
    console.log(`  loaded ${rows.length} rows into ${table}`);
  }

  // Bump sqlite_sequence so new AUTOINCREMENT ids continue past the imported max.
  for (const table of AUTOINC_TABLES) {
    const max = (sqlite.query(`SELECT MAX(id) AS m FROM "${table}"`).get() as { m: number | null })
      .m;
    if (max != null) {
      sqlite.run('DELETE FROM sqlite_sequence WHERE name = ?', [table]);
      sqlite.run('INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)', [table, max]);
    }
  }
});
tx();

// Validate FKs now that the full graph is loaded.
sqlite.exec('PRAGMA foreign_keys = ON;');
const fkViolations = sqlite.query('PRAGMA foreign_key_check').all();
if (fkViolations.length > 0) {
  console.error('FOREIGN KEY violations:', JSON.stringify(fkViolations, null, 2));
  process.exit(1);
}

// Verify row counts match the source.
let mismatch = false;
for (const table of TABLES) {
  const n = (sqlite.query(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c;
  const src = sourceCounts[table];
  const ok = n === src;
  if (!ok) mismatch = true;
  console.log(`  ${ok ? 'OK ' : 'MISMATCH'} ${table}: sqlite=${n} source=${src}`);
}
sqlite.close();

if (mismatch) {
  console.error('Row-count mismatch — aborting (no DB should be deployed).');
  process.exit(1);
}
console.log(`\n✅ migrated database written to ${outPath}`);

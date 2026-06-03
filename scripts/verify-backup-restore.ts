#!/usr/bin/env bun
/**
 * verify-backup-restore: prove a SQLite backup is actually restorable.
 *
 *   "A backup you've never restored is not a backup."
 *
 * Two modes:
 *   1. `bun scripts/verify-backup-restore.ts <backup-file>`
 *      Verify an EXISTING snapshot — point it at a backup pulled back from
 *      R2 / off-box storage to confirm a real restore would succeed.
 *
 *   2. `DATABASE_PATH=/app/data/diversif.db bun scripts/verify-backup-restore.ts`
 *      Take a fresh `VACUUM INTO` snapshot of the live DB (the documented,
 *      online-safe backup method — see README "Backups"), verify it, then
 *      delete the temp file. Proves the backup *method* yields a sound file.
 *      Safe to run against a live WAL database; the source is never modified.
 *
 * Checks run against the snapshot (opened read-only, exactly as a restore
 * would open it):
 *   - PRAGMA integrity_check  -> must be "ok" (no page corruption)
 *   - PRAGMA foreign_key_check -> must be empty (no dangling references)
 *   - Critical tables present and populated as expected
 *   - Row counts per table (printed; compared to source in mode 2)
 *
 * Exit code is non-zero on any failure so this can gate a backup cron / CI.
 */
import { Database } from 'bun:sqlite';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Tables whose absence or emptiness means the backup is unusable. `foods` is
// seeded on every boot, so a sound DB always has rows; `users` may legitimately
// be empty on a brand-new install, so we only assert presence for it.
const CRITICAL_TABLES = ['users', 'children', 'memberships', 'food_entries', 'foods'];
const MUST_BE_NONEMPTY = ['foods'];
// drizzle's bookkeeping table is not part of the user data set.
const SKIP_TABLES = new Set(['__drizzle_migrations', '_litestream_seq', '_litestream_lock']);

type Counts = Record<string, number>;

function userTables(db: Database): string[] {
  const rows = db
    .query<
      { name: string },
      []
    >("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
  return rows.map((r) => r.name).filter((n) => !SKIP_TABLES.has(n));
}

function rowCounts(db: Database, tables: string[]): Counts {
  const counts: Counts = {};
  for (const t of tables) {
    // Table names come from sqlite_master, not user input — safe to interpolate.
    const row = db.query<{ n: number }, []>(`SELECT count(*) AS n FROM "${t}"`).get();
    counts[t] = row?.n ?? 0;
  }
  return counts;
}

function fail(msg: string): never {
  console.error(`\n❌ Backup verification FAILED: ${msg}`);
  process.exit(1);
}

// --- Resolve what to verify -------------------------------------------------

const arg = process.argv[2];
let snapshotPath: string;
let cleanupSnapshot = false;
let sourceCounts: Counts | null = null;

if (arg) {
  if (!existsSync(arg)) fail(`backup file not found: ${arg}`);
  snapshotPath = arg;
  console.log(`Verifying existing backup: ${snapshotPath}`);
} else {
  const sourcePath = process.env.DATABASE_PATH;
  if (!sourcePath) {
    fail('pass a backup file as the first argument, or set DATABASE_PATH to snapshot the live DB');
  }
  if (!existsSync(sourcePath)) fail(`DATABASE_PATH does not exist: ${sourcePath}`);

  snapshotPath = path.join(tmpdir(), `diversif-backup-verify-${process.pid}.db`);
  rmSync(snapshotPath, { force: true });
  cleanupSnapshot = true;

  console.log(`Snapshotting live DB ${sourcePath} -> ${snapshotPath} (VACUUM INTO)…`);
  // Read-only: VACUUM INTO only reads the source, so we never risk the live DB.
  const source = new Database(sourcePath, { readonly: true });
  try {
    // VACUUM INTO produces a consistent, defragmented copy without touching the
    // source — the same command the README documents for online backups.
    source.run('VACUUM INTO ?', [snapshotPath]);
    sourceCounts = rowCounts(source, userTables(source));
  } finally {
    source.close();
  }
}

// --- Verify the snapshot exactly as a restore would open it -----------------

let exitCode = 0;
let snapshot: Database | null = null;
try {
  // A corrupt/truncated file throws here or on the first PRAGMA below — that is
  // itself a verification failure, handled in catch (not an uncaught crash).
  snapshot = new Database(snapshotPath, { readonly: true });

  const integrity = snapshot.query<{ integrity_check: string }, []>('PRAGMA integrity_check').all();
  const integrityOk = integrity.length === 1 && integrity[0]?.integrity_check === 'ok';
  console.log(`integrity_check: ${integrityOk ? 'ok' : JSON.stringify(integrity)}`);
  if (!integrityOk) exitCode = 1;

  const fkViolations = snapshot.query('PRAGMA foreign_key_check').all();
  console.log(
    `foreign_key_check: ${fkViolations.length === 0 ? 'ok' : `${fkViolations.length} violation(s)`}`
  );
  if (fkViolations.length > 0) {
    console.error(JSON.stringify(fkViolations, null, 2));
    exitCode = 1;
  }

  const tables = userTables(snapshot);
  for (const t of CRITICAL_TABLES) {
    if (!tables.includes(t)) {
      console.error(`  missing critical table: ${t}`);
      exitCode = 1;
    }
  }

  const counts = rowCounts(snapshot, tables);
  console.log('\nRow counts:');
  for (const t of tables) {
    const drift =
      sourceCounts && sourceCounts[t] !== counts[t] ? `  (source had ${sourceCounts[t]})` : '';
    console.log(`  ${t.padEnd(24)} ${String(counts[t]).padStart(8)}${drift}`);
  }

  for (const t of MUST_BE_NONEMPTY) {
    if ((counts[t] ?? 0) === 0) {
      console.error(`  expected rows in "${t}" but found 0 — backup looks truncated`);
      exitCode = 1;
    }
  }

  // In snapshot mode the copy is instantaneous, so any row-count drift means
  // the source changed mid-VACUUM (acceptable on a live DB) — report, don't
  // fail. Corruption/FK/missing-table are the hard failures above.
  if (sourceCounts) {
    const drifted = Object.keys(sourceCounts).filter((t) => sourceCounts![t] !== counts[t]);
    if (drifted.length > 0) {
      console.log(
        `\nNote: ${drifted.length} table(s) drifted during snapshot (live writes): ${drifted.join(', ')}`
      );
    }
  }
} catch (err) {
  // Thrown by Database open or any PRAGMA/query above when the file is corrupt,
  // truncated, or not a SQLite database at all.
  console.error(`  error reading snapshot: ${(err as Error).message}`);
  exitCode = 1;
} finally {
  snapshot?.close();
  if (cleanupSnapshot) {
    for (const f of [
      snapshotPath,
      `${snapshotPath}-wal`,
      `${snapshotPath}-shm`,
      `${snapshotPath}-journal`
    ]) {
      rmSync(f, { force: true });
    }
  }
}

if (exitCode === 0) {
  console.log('\n✅ Backup verified: restorable, non-corrupt, foreign keys intact.');
} else {
  console.error('\n❌ Backup verification FAILED — see errors above.');
}
process.exit(exitCode);

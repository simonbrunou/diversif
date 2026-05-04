import path from 'node:path';
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import type Database from 'better-sqlite3';

const DEFAULT_BACKUP_KEEP = 10;

export function resolveBackupKeep(raw: string | undefined): number {
  // Reject NaN, non-finite, and non-positive values so a malformed
  // DB_BACKUP_KEEP can never make the rotation loop delete every snapshot
  // (Array.slice(NaN) is treated as slice(0)).
  if (raw === undefined || raw === '') return DEFAULT_BACKUP_KEEP;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    console.warn(
      `[db] ignoring invalid DB_BACKUP_KEEP=${JSON.stringify(raw)}, falling back to ${DEFAULT_BACKUP_KEEP}`
    );
    return DEFAULT_BACKUP_KEEP;
  }
  return Math.floor(parsed);
}

export function backupBeforeMigrate(
  sqlite: Database.Database,
  dbPath: string,
  keep: number = resolveBackupKeep(process.env.DB_BACKUP_KEEP)
): string | null {
  // Online snapshot of the DB before migrations run, so a destructive migration
  // can never silently lose data — the operator can always roll back.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const target = path.join(backupDir, `${path.basename(dbPath, '.db')}-${stamp}.db`);
  try {
    sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } catch (err) {
    console.error('[db] pre-migration backup failed:', err);
    return null;
  }

  const snapshots = readdirSync(backupDir)
    .filter((f) => f.startsWith(`${path.basename(dbPath, '.db')}-`) && f.endsWith('.db'))
    .map((f) => ({ f, t: statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of snapshots.slice(keep)) {
    try {
      unlinkSync(path.join(backupDir, old.f));
    } catch {
      // best-effort rotation, ignore
    }
  }
  return target;
}

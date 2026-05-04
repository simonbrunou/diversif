import path from 'node:path';
import * as nodeFs from 'node:fs';
import type Database from 'better-sqlite3';

export type FsLike = Pick<typeof nodeFs, 'mkdirSync' | 'readdirSync' | 'statSync' | 'unlinkSync'>;

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
  keep: number = resolveBackupKeep(process.env.DB_BACKUP_KEEP),
  fs: FsLike = nodeFs
): string | null {
  // Online snapshot of the DB before migrations run, so a destructive migration
  // can never silently lose data — the operator can always roll back. This is
  // a safety net: if anything in here fails (read-only FS, permission denied,
  // a stat() on a poisoned entry), we log and return null instead of throwing,
  // so a backup problem can never turn into a startup outage.
  let target: string;
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    target = path.join(backupDir, `${path.basename(dbPath, '.db')}-${stamp}.db`);
    sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } catch (err) {
    console.error('[db] pre-migration backup failed:', err);
    return null;
  }

  try {
    const backupDir = path.dirname(target);
    const prefix = `${path.basename(dbPath, '.db')}-`;
    const snapshots = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(prefix) && f.endsWith('.db'))
      .map((f) => {
        try {
          return { f, t: fs.statSync(path.join(backupDir, f)).mtimeMs };
        } catch {
          return { f, t: 0 };
        }
      })
      .sort((a, b) => b.t - a.t);
    for (const old of snapshots.slice(keep)) {
      try {
        fs.unlinkSync(path.join(backupDir, old.f));
      } catch {
        // best-effort rotation, ignore
      }
    }
  } catch (err) {
    console.warn('[db] pre-migration backup rotation failed:', err);
  }
  return target;
}

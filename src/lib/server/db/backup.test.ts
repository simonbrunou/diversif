import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readdirSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backupBeforeMigrate, resolveBackupKeep } from './backup';

describe('resolveBackupKeep', () => {
  it('returns default 10 when env var is unset or empty', () => {
    expect(resolveBackupKeep(undefined)).toBe(10);
    expect(resolveBackupKeep('')).toBe(10);
  });

  it('returns parsed integer for valid positive numbers', () => {
    expect(resolveBackupKeep('1')).toBe(1);
    expect(resolveBackupKeep('5')).toBe(5);
    expect(resolveBackupKeep('100')).toBe(100);
  });

  it('floors fractional values', () => {
    expect(resolveBackupKeep('3.7')).toBe(3);
  });

  it('falls back to default for non-numeric, NaN, zero, or negative values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveBackupKeep('ten')).toBe(10);
      expect(resolveBackupKeep('NaN')).toBe(10);
      expect(resolveBackupKeep('0')).toBe(10);
      expect(resolveBackupKeep('-3')).toBe(10);
      expect(resolveBackupKeep('Infinity')).toBe(10);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('backupBeforeMigrate', () => {
  let workDir: string;
  let dbPath: string;
  let sqlite: Database.Database;

  beforeEach(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'diversif-backup-'));
    dbPath = path.join(workDir, 'diversif.db');
    sqlite = new Database(dbPath);
    sqlite.exec('CREATE TABLE marker (v integer)');
    sqlite.exec('INSERT INTO marker VALUES (42)');
  });

  afterEach(() => {
    sqlite.close();
    rmSync(workDir, { recursive: true, force: true });
  });

  it('writes a snapshot into <datadir>/backups and returns its path', () => {
    const snap = backupBeforeMigrate(sqlite, dbPath, 10);
    expect(snap).not.toBeNull();
    const backupDir = path.join(workDir, 'backups');
    const files = readdirSync(backupDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^diversif-.*\.db$/);

    // Snapshot is a real, readable SQLite file with the same data.
    const snapshot = new Database(snap!);
    const row = snapshot.prepare('SELECT v FROM marker').get() as { v: number };
    expect(row.v).toBe(42);
    snapshot.close();
  });

  it('rotates: keeps only the most recent `keep` snapshots', () => {
    const backupDir = path.join(workDir, 'backups');

    // Lay down three snapshots with a generous keep so none get rotated yet.
    const first = backupBeforeMigrate(sqlite, dbPath, 10)!;
    const second = backupBeforeMigrate(sqlite, dbPath, 10)!;
    const third = backupBeforeMigrate(sqlite, dbPath, 10)!;

    // Force distinct mtimes so the sort order in the rotation step is
    // deterministic regardless of timestamp collisions.
    const t = Math.floor(Date.now() / 1000);
    utimesSync(first, t - 30, t - 30);
    utimesSync(second, t - 20, t - 20);
    utimesSync(third, t - 10, t - 10);

    // Now take a fourth snapshot with keep=2. Only the two newest (the new
    // one + `third`) should survive.
    const fourth = backupBeforeMigrate(sqlite, dbPath, 2)!;
    const remaining = new Set(readdirSync(backupDir));
    expect(remaining.has(path.basename(first))).toBe(false);
    expect(remaining.has(path.basename(second))).toBe(false);
    expect(remaining.has(path.basename(third))).toBe(true);
    expect(remaining.has(path.basename(fourth))).toBe(true);
    expect(remaining.size).toBe(2);
  });

  it('does NOT delete every snapshot when keep is malformed (regression)', () => {
    // Exercises the production code path: pass a malformed env value through
    // resolveBackupKeep, which must clamp to 10 — not NaN. With NaN, slice(NaN)
    // === slice(0), and the rotation loop would unlink every snapshot
    // including the one just written.
    const backupDir = path.join(workDir, 'backups');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const keep = resolveBackupKeep('ten');
      const snap = backupBeforeMigrate(sqlite, dbPath, keep);
      expect(snap).not.toBeNull();
      expect(readdirSync(backupDir)).toContain(path.basename(snap!));
    } finally {
      warn.mockRestore();
    }
  });

  it('returns null and leaves no snapshot when VACUUM INTO fails', () => {
    const backupDir = path.join(workDir, 'backups');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Sabotage by closing the connection so exec() throws.
      sqlite.close();
      const result = backupBeforeMigrate(sqlite, dbPath, 10);
      expect(result).toBeNull();
      expect(err).toHaveBeenCalled();
      // Re-open so afterEach can clean up.
      sqlite = new Database(dbPath);
      const files = readdirSync(backupDir);
      expect(files.filter((f) => f.endsWith('.db'))).toEqual([]);
    } finally {
      err.mockRestore();
    }
  });

  it('safely escapes single quotes in the backup path', () => {
    const oddDir = mkdtempSync(path.join(tmpdir(), "diver'sif-"));
    const oddDb = path.join(oddDir, 'diversif.db');
    const odd = new Database(oddDb);
    odd.exec('CREATE TABLE marker (v integer); INSERT INTO marker VALUES (1)');
    try {
      const snap = backupBeforeMigrate(odd, oddDb, 10);
      expect(snap).not.toBeNull();
      const re = new Database(snap!);
      const row = re.prepare('SELECT v FROM marker').get() as { v: number };
      expect(row.v).toBe(1);
      re.close();
    } finally {
      odd.close();
      rmSync(oddDir, { recursive: true, force: true });
    }
  });
});

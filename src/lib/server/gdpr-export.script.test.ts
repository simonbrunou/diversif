// scripts/export-user.ts is a thin adapter over exportUserData. These tests
// cover only what the adapter owns: argument parsing, the read-only handle,
// exit codes, and a stdout that carries nothing but the JSON (an audit line
// there would corrupt the export). The payload is covered at the module's
// interface, in gdpr-export.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../test/db';
import { insertUser } from './gdpr-test-fixtures';

const scriptPath = path.resolve(import.meta.dir, '../../../scripts/export-user.ts');
const dbPath = path.join(tmpdir(), `diversif-export-script-${process.pid}.db`);
let userId: number;

beforeAll(async () => {
  await resetTestDb();
  userId = (await insertUser('script@example.com', 'Script')).id;
  rmSync(dbPath, { force: true });
  // VACUUM INTO writes a standalone copy the script opens read-only.
  testDb.run(sql`VACUUM INTO ${dbPath}`);
});

afterAll(() => {
  rmSync(dbPath, { force: true });
});

function runScript(args: string[], databasePath: string | null = dbPath) {
  const { DATABASE_PATH: _inherited, ...env } = process.env;
  const proc = Bun.spawnSync({
    cmd: [process.execPath, scriptPath, ...args],
    env: databasePath === null ? env : { ...env, DATABASE_PATH: databasePath },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString()
  };
}

describe('scripts/export-user.ts', () => {
  it('exports a user by --id, with only the JSON document on stdout', () => {
    const r = runScript(['--id', String(userId)]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).profile).toMatchObject({
      id: userId,
      email: 'script@example.com'
    });
  });

  it('exports a user by e-mail, whatever its case', () => {
    const r = runScript(['SCRIPT@Example.com']);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.stdout).profile.id).toBe(userId);
  });

  it('exits 2 with "Utilisateur introuvable." for an unknown user', () => {
    const r = runScript(['nobody@example.com']);
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr.trim()).toBe('Utilisateur introuvable.');
  });

  it('exits 1 with the usage line when no user is given', () => {
    const r = runScript([]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('Usage:');
  });

  it('opens the database read-only: a missing file is an error, never created', () => {
    const missing = path.join(tmpdir(), `diversif-export-missing-${process.pid}.db`);
    rmSync(missing, { force: true });
    const r = runScript(['--id', String(userId)], missing);
    expect(r.code).toBe(1);
    expect(r.stdout).toBe('');
    expect(existsSync(missing)).toBe(false);
  });

  it('exits 1 when DATABASE_PATH is missing', () => {
    const r = runScript(['--id', String(userId)], null);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain('DATABASE_PATH is required');
  });
});

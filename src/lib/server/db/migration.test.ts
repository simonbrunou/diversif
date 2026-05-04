import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

const DRIZZLE_DIR = path.resolve('./drizzle');

function applyMigrationFile(s: Database.Database, file: string) {
  const sql = readFileSync(path.join(DRIZZLE_DIR, file), 'utf8');
  for (const stmt of sql
    .split('--> statement-breakpoint')
    .map((x) => x.trim())
    .filter(Boolean)) {
    s.exec(stmt);
  }
}

function markMigrationsApplied(s: Database.Database, tagsToMark: string[]) {
  // Drizzle's better-sqlite3 migrator records applied migrations in
  // __drizzle_migrations(hash). Pre-populate it so migrate() picks up only
  // the migrations we want it to run.
  s.exec(
    `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
       id integer PRIMARY KEY AUTOINCREMENT,
       hash text NOT NULL,
       created_at numeric
     );`
  );
  const journal = JSON.parse(
    readFileSync(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8')
  ) as { entries: Array<{ tag: string; when: number }> };
  for (const entry of journal.entries) {
    if (!tagsToMark.includes(entry.tag)) continue;
    const sql = readFileSync(path.join(DRIZZLE_DIR, `${entry.tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    s.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
      hash,
      entry.when
    );
  }
}

function seedFixture(s: Database.Database) {
  const now = Date.now();
  s.prepare(
    `INSERT INTO users (email, password_hash, display_name, created_at)
     VALUES (?, ?, ?, ?)`
  ).run('alice@example.com', 'hash', 'Alice', now);
  const userId = (
    s.prepare('SELECT id FROM users WHERE email = ?').get('alice@example.com') as {
      id: number;
    }
  ).id;

  s.prepare(
    `INSERT INTO children (name, birth_date, created_by, created_at)
     VALUES (?, ?, ?, ?)`
  ).run('Bébé', '2025-01-01', userId, now);
  const childId = (s.prepare('SELECT id FROM children').get() as { id: number }).id;

  s.prepare(
    `INSERT INTO memberships (user_id, child_id, role, created_at)
     VALUES (?, ?, 'owner', ?)`
  ).run(userId, childId, now);

  s.prepare(
    `INSERT INTO foods (name, category, is_major_allergen, suggested_age_months, is_custom)
     VALUES (?, ?, 0, 6, 0)`
  ).run('Carotte', 'legumes');
  const foodId = (s.prepare('SELECT id FROM foods').get() as { id: number }).id;

  s.prepare(
    `INSERT INTO food_entries (child_id, food_id, given_at, reaction, logged_by, created_at)
     VALUES (?, ?, ?, 'ras', ?, ?)`
  ).run(childId, foodId, now, userId, now);

  s.prepare(
    `INSERT INTO invitations (code, child_id, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run('INVITE1', childId, userId, now, now + 86_400_000);

  s.prepare(
    `INSERT INTO passkeys (id, user_id, public_key, counter, transports, device_type, backed_up, name, created_at)
     VALUES (?, ?, 'pub', 0, '[]', 'singleDevice', 0, 'Yubikey', ?)`
  ).run('pk1', userId, now);
}

function counts(s: Database.Database) {
  const tables = [
    'users',
    'children',
    'memberships',
    'food_entries',
    'invitations',
    'passkeys'
  ] as const;
  const out = {} as Record<(typeof tables)[number], number>;
  for (const t of tables) {
    out[t] = (s.prepare(`SELECT count(*) AS c FROM ${t}`).get() as { c: number }).c;
  }
  return out;
}

describe('migration 0003 (GDPR FK relaxation)', () => {
  it('preserves dependent rows when run with foreign_keys disabled around migrate()', () => {
    // Reproduce the production setup: a DB at the schema level of 0002 with
    // user data, then apply 0003. Without disabling FKs around migrate(),
    // the SQLite table-rebuild dance inside the migration cascades all
    // child-referencing rows away.
    const sqlite = new Database(':memory:');

    // Build the DB up to migration 0002 by replaying SQL directly, then mark
    // those migrations as already applied so migrate() only runs 0003.
    applyMigrationFile(sqlite, '0000_volatile_firestar.sql');
    applyMigrationFile(sqlite, '0001_acoustic_genesis.sql');
    applyMigrationFile(sqlite, '0002_parched_the_stranger.sql');
    markMigrationsApplied(sqlite, [
      '0000_volatile_firestar',
      '0001_acoustic_genesis',
      '0002_parched_the_stranger'
    ]);

    seedFixture(sqlite);
    const before = counts(sqlite);
    expect(before).toEqual({
      users: 1,
      children: 1,
      memberships: 1,
      food_entries: 1,
      invitations: 1,
      passkeys: 1
    });

    // The fix: foreign_keys must be OFF before migrate() opens its
    // transaction. PRAGMA foreign_keys is a documented no-op inside a
    // transaction, so the PRAGMA inside the migration file alone is not
    // enough.
    sqlite.pragma('foreign_keys = OFF');
    const db = drizzle(sqlite, { schema });
    migrate(db as unknown as BetterSQLite3Database, { migrationsFolder: DRIZZLE_DIR });
    const violations = sqlite.pragma('foreign_key_check') as unknown[];
    expect(violations).toEqual([]);
    sqlite.pragma('foreign_keys = ON');

    const after = counts(sqlite);
    expect(after).toEqual(before);
  });

  it('demonstrates the original bug: with foreign_keys ON, dependent rows are wiped', () => {
    // This locks in the failure mode so a future regression is obvious.
    const sqlite = new Database(':memory:');
    applyMigrationFile(sqlite, '0000_volatile_firestar.sql');
    applyMigrationFile(sqlite, '0001_acoustic_genesis.sql');
    applyMigrationFile(sqlite, '0002_parched_the_stranger.sql');
    markMigrationsApplied(sqlite, [
      '0000_volatile_firestar',
      '0001_acoustic_genesis',
      '0002_parched_the_stranger'
    ]);
    seedFixture(sqlite);

    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite, { schema });
    migrate(db as unknown as BetterSQLite3Database, { migrationsFolder: DRIZZLE_DIR });

    const after = counts(sqlite);
    expect(after.users).toBe(1);
    expect(after.children).toBe(1);
    expect(after.passkeys).toBe(1);
    // These three are the symptom the user reported.
    expect(after.memberships).toBe(0);
    expect(after.food_entries).toBe(0);
    expect(after.invitations).toBe(0);
  });
});

describe('foreign_key_check after migrate()', () => {
  it('flags orphans that a sloppy migration would leave behind', () => {
    // SQLite's PRAGMA foreign_keys does not retroactively validate existing
    // rows when toggled on. The bootstrap (production and tests) must run
    // PRAGMA foreign_key_check after migrate() to catch a migration that
    // leaves orphans. This test simulates that situation and asserts that
    // the check actually surfaces the violation.
    const sqlite = new Database(':memory:');
    applyMigrationFile(sqlite, '0000_volatile_firestar.sql');
    applyMigrationFile(sqlite, '0001_acoustic_genesis.sql');
    applyMigrationFile(sqlite, '0002_parched_the_stranger.sql');
    applyMigrationFile(sqlite, '0003_needy_thunderbolt_ross.sql');
    seedFixture(sqlite);

    // Plant an orphan: a session row referencing a user that doesn't exist.
    // With foreign_keys=OFF this insert succeeds, mimicking a buggy migration.
    // (The 0003 migration ends with `PRAGMA foreign_keys=ON;`, which is
    // honored when applied outside a transaction, so we re-disable here.)
    sqlite.pragma('foreign_keys = OFF');
    sqlite
      .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .run('orphan', 9999, Date.now() + 86_400_000);

    const violations = sqlite.pragma('foreign_key_check') as unknown[];
    expect(Array.isArray(violations)).toBe(true);
    expect(violations.length).toBeGreaterThan(0);
  });
});

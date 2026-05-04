#!/usr/bin/env node
/**
 * Manuellement purge les sessions, invitations et défis WebAuthn expirés.
 * Usage: node scripts/cleanup.mjs
 *   ou : DATABASE_PATH=/abs/path/to.db node scripts/cleanup.mjs
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const dbPath = path.resolve(process.env.DATABASE_PATH ?? './data/diversif.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const now = Date.now();

const sessions = db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
const invitations = db.prepare('DELETE FROM invitations WHERE expires_at < ?').run(now);
const challenges = db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').run(now);

console.log(
  JSON.stringify(
    {
      databasePath: dbPath,
      deleted: {
        sessions: sessions.changes,
        invitations: invitations.changes,
        challenges: challenges.changes
      }
    },
    null,
    2
  )
);

db.close();

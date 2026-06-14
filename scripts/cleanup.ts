#!/usr/bin/env bun
/**
 * Manuellement purge les sessions, invitations et défis WebAuthn expirés.
 * Usage: DATABASE_PATH=/app/data/diversif.db bun scripts/cleanup.ts
 *
 * Couvre le sous-ensemble « en base » de la tâche périodique
 * `src/lib/server/cleanup.ts` (sessions / invitations / défis WebAuthn), pour
 * un déclenchement manuel hors process applicatif. La tâche périodique purge en
 * plus les clés d'idempotence et les compteurs de rate-limit (ces derniers en
 * mémoire du process, donc non purgeables depuis un script séparé).
 */
import { Database } from 'bun:sqlite';

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) {
  console.error('DATABASE_PATH is required (e.g. /app/data/diversif.db)');
  process.exit(1);
}

const db = new Database(databasePath);
// Wait (don't throw SQLITE_BUSY) if the app's single writer is briefly held.
db.exec('PRAGMA busy_timeout = 5000;');

// Timestamps are stored as epoch-ms integers (Drizzle `timestamp_ms`), so the
// expiry comparison is a plain integer compare against Date.now().
const now = Date.now();

const sessions = db.query('DELETE FROM sessions WHERE expires_at < ?').run(now);
const invitations = db.query('DELETE FROM invitations WHERE expires_at < ?').run(now);
const challenges = db.query('DELETE FROM webauthn_challenges WHERE expires_at < ?').run(now);

console.log(
  JSON.stringify(
    {
      databasePath,
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

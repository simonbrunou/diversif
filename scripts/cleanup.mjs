#!/usr/bin/env node
/**
 * Manuellement purge les sessions, invitations et défis WebAuthn expirés.
 * Usage: DATABASE_URL=postgres://… node scripts/cleanup.mjs
 */
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const now = new Date();

const sessions = await client.query('DELETE FROM sessions WHERE expires_at < $1', [now]);
const invitations = await client.query('DELETE FROM invitations WHERE expires_at < $1', [now]);
const challenges = await client.query('DELETE FROM webauthn_challenges WHERE expires_at < $1', [
  now
]);

console.log(
  JSON.stringify(
    {
      databaseUrl: databaseUrl.replace(/:[^:@]*@/, ':***@'),
      deleted: {
        sessions: sessions.rowCount ?? 0,
        invitations: invitations.rowCount ?? 0,
        challenges: challenges.rowCount ?? 0
      }
    },
    null,
    2
  )
);

await client.end();

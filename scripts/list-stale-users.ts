#!/usr/bin/env node
/**
 * Liste les comptes inactifs depuis plus de RETENTION_INACTIVE_DAYS jours
 * (ou la valeur par défaut de 1095 jours, soit 3 ans). N'effectue AUCUNE
 * suppression. Utilisez ces résultats pour décider d'un suivi manuel.
 *
 * Usage: DATABASE_URL=postgres://… node scripts/list-stale-users.mjs
 *   ou : RETENTION_INACTIVE_DAYS=730 DATABASE_URL=… node scripts/list-stale-users.mjs
 *
 * L'inactivité se mesure sur le maximum de :
 *   - users.last_login_at (mis à jour à chaque connexion ET à chaque
 *     renouvellement de session)
 *   - la date d'expiration la plus récente d'une session encore en base
 *     moins la durée d'une session (preuve d'activité récente)
 *   - users.created_at (filet de sécurité pour les très vieux comptes
 *     n'ayant jamais ouvert de session).
 */
import pg from 'pg';

const DEFAULT_DAYS = 1095;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  process.exit(1);
}

const rawDays = process.env.RETENTION_INACTIVE_DAYS;
const parsedDays = rawDays !== undefined ? Number.parseInt(rawDays, 10) : NaN;
const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : DEFAULT_DAYS;
const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const sessionDurationInterval = `${SESSION_DURATION_MS} milliseconds`;

const res = await client.query(
  `SELECT u.id, u.email, u.display_name, u.created_at, u.last_login_at,
          (SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) AS latest_session_expires_at,
          GREATEST(
            COALESCE(u.last_login_at, 'epoch'::timestamptz),
            COALESCE(u.created_at, 'epoch'::timestamptz),
            COALESCE(
              (SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) - $1::interval,
              'epoch'::timestamptz
            )
          ) AS last_active_at
     FROM users u
     ORDER BY last_active_at ASC`,
  [sessionDurationInterval]
);

const stale = res.rows.filter((u) => u.last_active_at && new Date(u.last_active_at) < threshold);

console.log(
  JSON.stringify(
    {
      databaseUrl: databaseUrl.replace(/:[^:@]*@/, ':***@'),
      retentionDays: days,
      thresholdIso: threshold.toISOString(),
      count: stale.length,
      users: stale.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: u.created_at ? new Date(u.created_at).toISOString() : null,
        lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
        latestSessionExpiresAt: u.latest_session_expires_at
          ? new Date(u.latest_session_expires_at).toISOString()
          : null
      }))
    },
    null,
    2
  )
);

await client.end();

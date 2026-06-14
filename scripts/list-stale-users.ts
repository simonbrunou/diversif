#!/usr/bin/env bun
/**
 * Liste les comptes inactifs depuis plus de RETENTION_INACTIVE_DAYS jours
 * (ou la valeur par défaut de 1095 jours, soit 3 ans). N'effectue AUCUNE
 * suppression. Utilisez ces résultats pour décider d'un suivi manuel.
 *
 * Usage: DATABASE_PATH=/app/data/diversif.db bun scripts/list-stale-users.ts
 *   ou : RETENTION_INACTIVE_DAYS=730 DATABASE_PATH=… bun scripts/list-stale-users.ts
 *
 * L'inactivité se mesure sur le maximum de :
 *   - users.last_login_at (mis à jour à chaque connexion ET à chaque
 *     renouvellement de session)
 *   - la date d'expiration la plus récente d'une session encore en base
 *     moins la durée d'une session (preuve d'activité récente)
 *   - users.created_at (filet de sécurité pour les très vieux comptes
 *     n'ayant jamais ouvert de session).
 */
import { Database } from 'bun:sqlite';

const DEFAULT_DAYS = 1095;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) {
  console.error('DATABASE_PATH is required (e.g. /app/data/diversif.db)');
  process.exit(1);
}

const rawDays = process.env.RETENTION_INACTIVE_DAYS;
const parsedDays = rawDays !== undefined ? Number.parseInt(rawDays, 10) : NaN;
const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : DEFAULT_DAYS;
const thresholdMs = Date.now() - days * 24 * 60 * 60 * 1000;

const db = new Database(databasePath, { readonly: true });

type StaleRow = {
  id: number;
  email: string;
  displayName: string;
  createdAt: number | null;
  lastLoginAt: number | null;
  latestSessionExpiresAt: number | null;
  lastActiveAt: number;
};

// Timestamps are epoch-ms integers, so SQLite's scalar `max(a, b, c)` plus plain
// arithmetic replaces Postgres GREATEST + interval. `last_active_at` is the most
// recent of last_login_at, created_at, and (latest session expiry − one session
// duration). created_at is NOT NULL, so the COALESCE(..., 0) floor is only a
// guard and never actually selected.
const rows = db
  .query(
    `SELECT u.id,
            u.email,
            u.display_name AS displayName,
            u.created_at AS createdAt,
            u.last_login_at AS lastLoginAt,
            (SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) AS latestSessionExpiresAt,
            max(
              COALESCE(u.last_login_at, 0),
              COALESCE(u.created_at, 0),
              COALESCE((SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) - ?, 0)
            ) AS lastActiveAt
       FROM users u
       ORDER BY lastActiveAt ASC`
  )
  .all(SESSION_DURATION_MS) as StaleRow[];

const stale = rows.filter((u) => u.lastActiveAt < thresholdMs);
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

console.log(
  JSON.stringify(
    {
      databasePath,
      retentionDays: days,
      thresholdIso: new Date(thresholdMs).toISOString(),
      count: stale.length,
      users: stale.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        createdAt: iso(u.createdAt),
        lastLoginAt: iso(u.lastLoginAt),
        latestSessionExpiresAt: iso(u.latestSessionExpiresAt)
      }))
    },
    null,
    2
  )
);

db.close();

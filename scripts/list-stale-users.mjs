#!/usr/bin/env node
/**
 * Liste les comptes inactifs depuis plus de RETENTION_INACTIVE_DAYS jours
 * (ou la valeur par défaut de 1095 jours, soit 3 ans). N'effectue AUCUNE
 * suppression. Utilisez ces résultats pour décider d'un suivi manuel.
 *
 * Usage: node scripts/list-stale-users.mjs
 *   ou : RETENTION_INACTIVE_DAYS=730 node scripts/list-stale-users.mjs
 *
 * L'inactivité se mesure sur le maximum de :
 *   - users.last_login_at (mis à jour à chaque connexion ET à chaque
 *     renouvellement de session)
 *   - la date d'expiration la plus récente d'une session encore en base
 *     moins la durée d'une session (preuve d'activité récente)
 *   - users.created_at (filet de sécurité pour les très vieux comptes
 *     n'ayant jamais ouvert de session).
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const DEFAULT_DAYS = 1095;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

const rawDays = process.env.RETENTION_INACTIVE_DAYS;
const parsedDays = rawDays !== undefined ? Number.parseInt(rawDays, 10) : NaN;
const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : DEFAULT_DAYS;
const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
const dbPath = path.resolve(process.env.DATABASE_PATH ?? './data/diversif.db');

const db = new Database(dbPath, { readonly: true });
const stale = db
  .prepare(
    `SELECT u.id, u.email, u.display_name, u.created_at, u.last_login_at,
            (SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id) AS latest_session_expires_at
       FROM users u
       WHERE MAX(
         COALESCE(u.last_login_at, 0),
         COALESCE(u.created_at, 0),
         COALESCE((SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id), 0) - ?
       ) < ?
       ORDER BY MAX(
         COALESCE(u.last_login_at, 0),
         COALESCE(u.created_at, 0),
         COALESCE((SELECT MAX(s.expires_at) FROM sessions s WHERE s.user_id = u.id), 0) - ?
       ) ASC`
  )
  .all(SESSION_DURATION_MS, threshold, SESSION_DURATION_MS);

console.log(
  JSON.stringify(
    {
      databasePath: dbPath,
      retentionDays: days,
      thresholdIso: new Date(threshold).toISOString(),
      count: stale.length,
      users: stale.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: new Date(u.created_at).toISOString(),
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

db.close();

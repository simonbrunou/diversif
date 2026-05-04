#!/usr/bin/env node
/**
 * Liste les comptes inactifs depuis plus de RETENTION_INACTIVE_DAYS jours
 * (ou la valeur par défaut de 1095 jours, soit 3 ans). N'effectue AUCUNE
 * suppression. Utilisez ces résultats pour décider d'un suivi manuel.
 *
 * Usage: node scripts/list-stale-users.mjs
 *   ou : RETENTION_INACTIVE_DAYS=730 node scripts/list-stale-users.mjs
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const days = Number.parseInt(process.env.RETENTION_INACTIVE_DAYS ?? '1095', 10);
const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
const dbPath = path.resolve(process.env.DATABASE_PATH ?? './data/diversif.db');

const db = new Database(dbPath, { readonly: true });
const stale = db
  .prepare(
    `SELECT id, email, display_name, created_at, last_login_at
     FROM users
     WHERE COALESCE(last_login_at, created_at) < ?
     ORDER BY COALESCE(last_login_at, created_at) ASC`
  )
  .all(threshold);

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
        lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : null
      }))
    },
    null,
    2
  )
);

db.close();

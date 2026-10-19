#!/usr/bin/env bun
/**
 * Exporte les données d'un utilisateur au format JSON pour répondre
 * manuellement à une demande RGPD article 15 / 20 (en cas de besoin
 * d'agir en lieu et place de l'utilisateur).
 *
 * Depuis un clone (après `bun run paraglide`, dont le schéma importe les
 * messages compilés) :
 *   DATABASE_PATH=… bun scripts/export-user.ts <email>
 *   DATABASE_PATH=… bun scripts/export-user.ts --id <userId>
 * Dans le conteneur, `bun run build` en livre une version autonome :
 *   DATABASE_PATH=/app/data/diversif.db bun build/scripts/export-user.js <email>
 *
 * Même export que /account/export (src/lib/server/gdpr-export.ts), avec
 * OPERATOR_EXPORT : sans plafond de lignes ni entrée d'audit.
 */
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '#lib/server/db/schema.js';
import { OPERATOR_EXPORT, UserNotFoundError, exportUserData } from '#lib/server/gdpr-export.js';

const args = process.argv.slice(2);
let userId: number | null = null;
let email: string | null = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id') userId = Number.parseInt(args[++i], 10);
  else if (!email) email = args[i];
}

if (!userId && !email) {
  console.error('Usage: bun scripts/export-user.ts <email> | --id <userId>');
  process.exit(1);
}

const databasePath = process.env.DATABASE_PATH;
if (!databasePath) {
  console.error('DATABASE_PATH is required (e.g. /app/data/diversif.db)');
  process.exit(1);
}

const sqlite = new Database(databasePath, { readonly: true });
try {
  const payload = await exportUserData(
    drizzle(sqlite, { schema }),
    userId ? { userId } : { email: email! },
    OPERATOR_EXPORT
  );
  console.log(JSON.stringify(payload, null, 2));
} catch (err) {
  if (!(err instanceof UserNotFoundError)) throw err;
  console.error('Utilisateur introuvable.');
  process.exitCode = 2;
} finally {
  sqlite.close();
}

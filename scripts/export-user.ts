#!/usr/bin/env node
/**
 * Exporte les données d'un utilisateur au format JSON pour répondre
 * manuellement à une demande RGPD article 15 / 20 (en cas de besoin
 * d'agir en lieu et place de l'utilisateur).
 *
 * Usage: DATABASE_URL=postgres://… node scripts/export-user.mjs <email>
 *   ou : DATABASE_URL=… node scripts/export-user.mjs --id <userId>
 */
import pg from 'pg';

const args = process.argv.slice(2);
let userId = null;
let email = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id') userId = Number.parseInt(args[++i], 10);
  else if (!email) email = args[i];
}

if (!userId && !email) {
  console.error('Usage: node scripts/export-user.mjs <email> | --id <userId>');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (e.g. postgres://user:pass@host:5432/diversif)');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

const userRes = userId
  ? await client.query('SELECT * FROM users WHERE id = $1', [userId])
  : await client.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
const user = userRes.rows[0];

if (!user) {
  console.error('Utilisateur introuvable.');
  await client.end();
  process.exit(2);
}

const membershipsRes = await client.query('SELECT * FROM memberships WHERE user_id = $1', [
  user.id
]);
const memberships = membershipsRes.rows;
const childIds = memberships.map((m) => m.child_id);

const children = childIds.length
  ? (await client.query('SELECT * FROM children WHERE id = ANY($1::int[])', [childIds])).rows
  : [];
const entries = childIds.length
  ? (
      await client.query(
        `SELECT fe.*, f.name AS food_name
           FROM food_entries fe
           JOIN foods f ON f.id = fe.food_id
          WHERE fe.child_id = ANY($1::int[])
          ORDER BY fe.given_at ASC`,
        [childIds]
      )
    ).rows
  : [];
const passkeysRes = await client.query('SELECT * FROM passkeys WHERE user_id = $1', [user.id]);
const passkeys = passkeysRes.rows;

const iso = (v) => (v == null ? null : new Date(v).toISOString());

const payload = {
  exportedAt: new Date().toISOString(),
  generator: 'diversif',
  schemaVersion: 1,
  profile: {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    createdAt: iso(user.created_at),
    tosAcceptedAt: iso(user.tos_accepted_at),
    privacyAcceptedAt: iso(user.privacy_accepted_at),
    ageConfirmedAt: iso(user.age_confirmed_at),
    lastLoginAt: iso(user.last_login_at)
  },
  children: children.map((c) => {
    const m = memberships.find((mm) => mm.child_id === c.id);
    return {
      id: c.id,
      name: c.name,
      birthDate: c.birth_date,
      createdAt: iso(c.created_at),
      membership: { role: m?.role ?? 'member', joinedAt: iso(m?.created_at) },
      foodEntries: entries
        .filter((e) => e.child_id === c.id)
        .map((e) => ({
          id: e.id,
          foodId: e.food_id,
          foodName: e.food_name,
          givenAt: iso(e.given_at),
          reaction: e.reaction,
          notes: e.notes,
          loggedByMe: e.logged_by === user.id,
          createdAt: iso(e.created_at)
        }))
    };
  }),
  passkeys: passkeys.map((p) => ({
    id: p.id,
    name: p.name,
    deviceType: p.device_type,
    backedUp: !!p.backed_up,
    transports: p.transports,
    createdAt: iso(p.created_at),
    lastUsedAt: iso(p.last_used_at)
  }))
};

console.log(JSON.stringify(payload, null, 2));
await client.end();

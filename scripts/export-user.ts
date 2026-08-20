#!/usr/bin/env bun
/**
 * Exporte les données d'un utilisateur au format JSON pour répondre
 * manuellement à une demande RGPD article 15 / 20 (en cas de besoin
 * d'agir en lieu et place de l'utilisateur).
 *
 * Usage: DATABASE_PATH=/app/data/diversif.db bun scripts/export-user.ts <email>
 *   ou : DATABASE_PATH=… bun scripts/export-user.ts --id <userId>
 */
import { Database } from 'bun:sqlite';

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

// Raw SQLite rows: columns come back snake_case (the names declared in schema.ts)
// and `timestamp_ms` columns are plain epoch-ms integers.
type UserRow = {
  id: number;
  email: string;
  display_name: string;
  created_at: number | null;
  tos_accepted_at: number | null;
  privacy_accepted_at: number | null;
  age_confirmed_at: number | null;
  last_login_at: number | null;
};
type MembershipRow = { user_id: number; child_id: number; role: string; created_at: number | null };
type ChildRow = { id: number; name: string; birth_date: string; created_at: number | null };
type EntryRow = {
  id: number;
  child_id: number;
  food_id: number;
  food_name: string;
  given_at: number | null;
  reaction: string;
  notes: string | null;
  logged_by: number | null;
  created_at: number | null;
};
type PreparedMealRow = {
  id: number;
  child_id: number;
  brand: string;
  name: string;
  ingredient_food_ids: string;
  last_used_at: number | null;
  created_at: number | null;
  updated_at: number | null;
};
type PasskeyRow = {
  id: string;
  name: string;
  device_type: string;
  backed_up: number;
  transports: string | null;
  created_at: number | null;
  last_used_at: number | null;
};

const db = new Database(databasePath, { readonly: true });

const user = (
  userId
    ? db.query('SELECT * FROM users WHERE id = ?').get(userId)
    : db.query('SELECT * FROM users WHERE email = ?').get(email!.toLowerCase())
) as UserRow | null;

if (!user) {
  console.error('Utilisateur introuvable.');
  db.close();
  process.exit(2);
}

const memberships = db
  .query('SELECT * FROM memberships WHERE user_id = ?')
  .all(user.id) as MembershipRow[];
const childIds = memberships.map((m) => m.child_id);
// SQLite has no array params, so expand `IN (?, ?, …)` to one placeholder per id.
const inList = childIds.map(() => '?').join(',');

const children = childIds.length
  ? (db.query(`SELECT * FROM children WHERE id IN (${inList})`).all(...childIds) as ChildRow[])
  : [];
const entries = childIds.length
  ? (db
      .query(
        `SELECT fe.*, f.name AS food_name
           FROM food_entries fe
           JOIN foods f ON f.id = fe.food_id
          WHERE fe.child_id IN (${inList})
          ORDER BY fe.given_at ASC`
      )
      .all(...childIds) as EntryRow[])
  : [];
const preparedMeals = childIds.length
  ? (db
      .query(`SELECT * FROM prepared_meals WHERE child_id IN (${inList}) ORDER BY created_at ASC`)
      .all(...childIds) as PreparedMealRow[])
  : [];
const passkeys = db.query('SELECT * FROM passkeys WHERE user_id = ?').all(user.id) as PasskeyRow[];

const iso = (v: number | null) => (v == null ? null : new Date(v).toISOString());
const parseTransports = (v: string | null): string[] => {
  if (!v) return [];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
};
const parseFoodIds = (v: string): number[] => {
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
};

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
      membership: { role: m?.role ?? 'member', joinedAt: iso(m?.created_at ?? null) },
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
        })),
      preparedMeals: preparedMeals
        .filter((meal) => meal.child_id === c.id)
        .map((meal) => ({
          id: meal.id,
          brand: meal.brand,
          name: meal.name,
          ingredientFoodIds: parseFoodIds(meal.ingredient_food_ids),
          lastUsedAt: iso(meal.last_used_at),
          createdAt: iso(meal.created_at),
          updatedAt: iso(meal.updated_at)
        }))
    };
  }),
  passkeys: passkeys.map((p) => ({
    id: p.id,
    name: p.name,
    deviceType: p.device_type,
    backedUp: !!p.backed_up,
    transports: parseTransports(p.transports),
    createdAt: iso(p.created_at),
    lastUsedAt: iso(p.last_used_at)
  }))
};

console.log(JSON.stringify(payload, null, 2));
db.close();

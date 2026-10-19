// RGPD article 15 / 20 export: everything Diversif holds about one user, as a
// JSON-ready object. Two adapters call it with their own database handle:
//   - /account/export passes the app's db and keeps the default options
//     (row cap + audit trail);
//   - scripts/export-user.ts passes a drizzle handle over a read-only
//     bun:sqlite connection, and OPERATOR_EXPORT.
// This module must stay free of import-time side effects: the operator script
// is bundled from it (`bun run build:scripts`), so importing the `db`
// singleton here would open, migrate and seed DATABASE_PATH from the script.
import { and, asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { audit, type AuditEvent } from './audit';
import {
  children,
  foodEntries,
  foods,
  invitations,
  memberships,
  passkeys,
  preparedMeals,
  symptoms,
  tipDismissals,
  users,
  type FoodEntry,
  type Membership,
  type Passkey,
  type Symptom
} from './db/schema';
import type * as schema from './db/schema';
import type { TextureKey } from '#lib/utils/textures.js';
import { parseDietExclusions, type DietExclusion } from '#lib/utils/diet.js';

type Db = BunSQLiteDatabase<typeof schema>;

export type ExportedUser = {
  exportedAt: string;
  generator: 'diversif';
  schemaVersion: 1;
  profile: {
    id: number;
    email: string;
    displayName: string;
    createdAt: string;
    tosAcceptedAt: string | null;
    privacyAcceptedAt: string | null;
    ageConfirmedAt: string | null;
    lastLoginAt: string | null;
    lastExportAt: string | null;
  };
  children: Array<{
    id: number;
    name: string;
    birthDate: string;
    createdAt: string;
    dietaryExclusions: DietExclusion[];
    membership: { role: Membership['role']; joinedAt: string };
    foodEntries: Array<{
      id: number;
      foodId: number;
      foodName: string;
      givenAt: string;
      reaction: FoodEntry['reaction'];
      notes: string | null;
      texture: TextureKey | null;
      loggedByMe: boolean;
      mealId: string | null;
      createdAt: string;
      symptoms: Array<{
        id: number;
        observedAt: string;
        label: Symptom['label'];
        note: string | null;
        recordedByMe: boolean;
        createdAt: string;
      }>;
    }>;
    preparedMeals: Array<{
      id: number;
      brand: string;
      name: string;
      ingredients: Array<{ foodId: number; foodName: string | null }>;
      lastUsedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
  passkeys: Array<{
    id: string;
    name: string;
    deviceType: Passkey['deviceType'];
    backedUp: boolean;
    transports: string[];
    createdAt: string;
    lastUsedAt: string | null;
  }>;
  // Co-parent invitations the user generated (relationship: 'sent') or
  // accepted to join a shared child (relationship: 'accepted'). Personal
  // data per RGPD article 15.
  //
  // The invitation `code` itself is deliberately omitted : it's a bearer
  // token, structurally identical to a session id (matched by exact-string
  // lookup at the join endpoint, redeemable by anyone who possesses it
  // until expiry). Including it in a downloadable archive lets a leaked or
  // intercepted export be redeemed for co-parent access on still-unused
  // codes. The exported metadata (childId, relationship, dates) is what
  // the user actually has portability interest in.
  invitations: Array<{
    childId: number;
    relationship: 'sent' | 'accepted';
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
  }>;
  // Per-user/per-child reminder dismissals. Surface them so users can see
  // which tips they've already silenced.
  tipDismissals: Array<{
    childId: number;
    reminderKey: string;
    dismissedAt: string;
  }>;
};

/** Whose data to export: by id (the signed-in user) or by e-mail (operator). */
type ExportSubject = { userId: number } | { email: string };

type ExportAuditEvent = Extract<
  AuditEvent,
  { type: 'account.exported' | 'account.export_blocked' }
>;

export type ExportOptions = {
  /**
   * Refuse with ExportTooLargeError when the user's food-entry + symptom rows
   * exceed this count. `null` disables the cap. Default EXPORT_ROW_LIMIT.
   */
  rowLimit?: number | null;
  /**
   * Receives `account.exported` (on success) and `account.export_blocked`
   * (on a cap refusal). `null` records nothing. Default: audit(), which
   * writes one JSON line to stdout.
   */
  audit?: ((event: ExportAuditEvent) => void) | null;
};

/**
 * Options for the operator script (scripts/export-user.ts):
 *   - no row cap, because the 413 the route returns above the cap tells the
 *     user to ask for a manual export, and this is that export;
 *   - no audit entry, as before this module existed: audit() writes on
 *     stdout, where the script prints the export itself.
 */
export const OPERATOR_EXPORT = { rowLimit: null, audit: null } as const satisfies ExportOptions;

// Hard ceiling on the number of food-entry + symptom rows we'll serialise in
// a single export. The endpoint synchronously buffers the whole JSON payload
// in memory; without a guard rail, a pathologically-long log OR symptom
// history could OOM the process or blow past upstream proxy response
// limits. We do NOT silently truncate : if the combined count is over this,
// exportUserData throws ExportTooLargeError so the caller can surface an
// actionable error rather than handing the user an incomplete archive
// (which would breach RGPD article 15).
//
// 50k rows is well above any realistic user (≈9 years of daily logging with
// a symptom on every entry, corresponding to ~12MB of JSON
// pre-pretty-print). If we ever see it hit in practice, the right fix is to
// stream the response, not to lower the cap.
const EXPORT_ROW_LIMIT = 50_000;

export class ExportTooLargeError extends Error {
  readonly count: number;
  readonly limit: number;
  constructor(count: number, limit: number) {
    super(`Export too large: ${count} rows exceeds limit of ${limit}`);
    this.name = 'ExportTooLargeError';
    this.count = count;
    this.limit = limit;
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}

// Drizzle's `timestamp_ms` mode always materializes timestamps as Date instances.
const isoOrNull = (v: Date | null | undefined): string | null =>
  v == null ? null : v.toISOString();

// Groups rows by a derived key, preserving each group's original row order.
function groupBy<T, K>(rows: readonly T[], keyOf: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

// The export's three JSON text columns (children.dietary_exclusions,
// passkeys.transports, prepared_meals.ingredient_food_ids) are selected raw
// and parsed here: drizzle's json mode throws on a malformed value, and a
// hand-edited row or a bad restore must not block an article 15 export (the
// operator script is the fallback when the self-service one fails). A value
// that doesn't parse to an array reads as an empty list.
const rawJson = (column: AnySQLiteColumn) => sql<string | null>`${column}`;

function jsonArray(raw: string | null): unknown[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function findUser(db: Db, subject: ExportSubject) {
  // E-mails are stored lower-cased (see auth.ts), so match the same way.
  const where =
    'userId' in subject
      ? eq(users.id, subject.userId)
      : eq(users.email, subject.email.toLowerCase());
  const [user] = await db.select().from(users).where(where).limit(1);
  if (!user) throw new UserNotFoundError();
  return user;
}

// Counts food_entries + symptoms rows for the given children. Symptoms are
// buffered in memory right alongside their parent entry and are just as
// unbounded per child, so both count against the same ceiling.
async function countExportRows(db: Db, childIds: number[]): Promise<number> {
  const [[entryCount], [symptomCount]] = await Promise.all([
    db.select({ n: count() }).from(foodEntries).where(inArray(foodEntries.childId, childIds)),
    db.select({ n: count() }).from(symptoms).where(inArray(symptoms.childId, childIds))
  ]);
  return entryCount.n + symptomCount.n;
}

// Every row scoped to the user's children: food entries (with the food name),
// their symptoms bucketed per entry, prepared meals (with ingredient names)
// and the user's tip dismissals. With no children, drizzle compiles
// `inArray(col, [])` to `false`, so each query returns no rows.
async function loadChildRows(db: Db, userId: number, childIds: number[]) {
  const entries = await db
    .select({
      id: foodEntries.id,
      childId: foodEntries.childId,
      foodId: foodEntries.foodId,
      foodName: foods.name,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      notes: foodEntries.notes,
      texture: foodEntries.texture,
      loggedBy: foodEntries.loggedBy,
      mealId: foodEntries.mealId,
      createdAt: foodEntries.createdAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(inArray(foodEntries.childId, childIds))
    .orderBy(asc(foodEntries.givenAt));

  // Scoped by child_id (not by the entry ids above) so a symptom row can
  // never leak across a child the user isn't a member of.
  const symptomRows = await db
    .select({
      id: symptoms.id,
      foodEntryId: symptoms.foodEntryId,
      observedAt: symptoms.observedAt,
      label: symptoms.label,
      note: symptoms.note,
      createdBy: symptoms.createdBy,
      createdAt: symptoms.createdAt
    })
    .from(symptoms)
    .where(inArray(symptoms.childId, childIds))
    .orderBy(asc(symptoms.observedAt));

  const meals = (
    await db
      .select({
        id: preparedMeals.id,
        childId: preparedMeals.childId,
        brand: preparedMeals.brand,
        name: preparedMeals.name,
        ingredientFoodIds: rawJson(preparedMeals.ingredientFoodIds),
        lastUsedAt: preparedMeals.lastUsedAt,
        createdAt: preparedMeals.createdAt,
        updatedAt: preparedMeals.updatedAt
      })
      .from(preparedMeals)
      .where(inArray(preparedMeals.childId, childIds))
      .orderBy(asc(preparedMeals.createdAt))
  ).map((meal) => ({
    ...meal,
    ingredientFoodIds: jsonArray(meal.ingredientFoodIds).filter((id): id is number =>
      Number.isInteger(id)
    )
  }));

  const tips = await db
    .select({
      childId: tipDismissals.childId,
      reminderKey: tipDismissals.reminderKey,
      dismissedAt: tipDismissals.dismissedAt
    })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), inArray(tipDismissals.childId, childIds)))
    .orderBy(asc(tipDismissals.dismissedAt));

  return {
    entries,
    symptomsByEntryId: groupBy(symptomRows, (s) => s.foodEntryId),
    meals,
    mealFoodNames: await loadFoodNames(
      db,
      meals.flatMap((meal) => meal.ingredientFoodIds)
    ),
    tips
  };
}

// Prepared meals store bare food ids; resolve them to names independently of
// food_entries so a meal stays readable after its logs are deleted.
async function loadFoodNames(db: Db, foodIds: number[]): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: foods.id, name: foods.name })
    .from(foods)
    .where(inArray(foods.id, [...new Set(foodIds)]));
  return new Map(rows.map((food) => [food.id, food.name]));
}

// Invitations the user generated OR consumed. The `relationship` field
// disambiguates the two so the same code (sent and later used by the
// same user) shows up twice : that's the right semantic.
async function loadInvitations(db: Db, userId: number): Promise<ExportedUser['invitations']> {
  const rows = await db
    .select({
      childId: invitations.childId,
      createdBy: invitations.createdBy,
      usedBy: invitations.usedBy,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt,
      usedAt: invitations.usedAt
    })
    .from(invitations)
    .where(or(eq(invitations.createdBy, userId), eq(invitations.usedBy, userId)))
    .orderBy(asc(invitations.createdAt));

  return rows.flatMap((inv) => {
    const base = {
      childId: inv.childId,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
      usedAt: isoOrNull(inv.usedAt)
    };
    const out: ExportedUser['invitations'] = [];
    if (inv.createdBy === userId) out.push({ ...base, relationship: 'sent' });
    if (inv.usedBy === userId) out.push({ ...base, relationship: 'accepted' });
    return out;
  });
}

/**
 * Builds the article 15 / 20 export payload for one user.
 *
 * Read-only: it runs SELECTs only, so a `{ readonly: true }` handle works.
 * Excluded by design: password hash, raw session ids, WebAuthn challenges,
 * passkey public keys and signature counters, invitation codes (security
 * material with no portability value to the user).
 *
 * Throws UserNotFoundError when the subject doesn't exist, and
 * ExportTooLargeError (after auditing `account.export_blocked`) when the
 * row cap trips: the food entries and symptoms are counted before any of them
 * is loaded, and the archive is refused rather than truncated.
 */
export async function exportUserData(
  db: Db,
  subject: ExportSubject,
  options: ExportOptions = {}
): Promise<ExportedUser> {
  const { rowLimit = EXPORT_ROW_LIMIT, audit: emitAudit = audit } = options;
  const user = await findUser(db, subject);
  const userId = user.id;

  // The user's children, each with the user's own membership on it. Ordered
  // by child id, the order the previous `id IN (…)` primary-key lookup
  // returned them in.
  const childMemberships = await db
    .select({
      child: {
        id: children.id,
        name: children.name,
        birthDate: children.birthDate,
        createdAt: children.createdAt,
        dietaryExclusions: rawJson(children.dietaryExclusions)
      },
      membership: { role: memberships.role, createdAt: memberships.createdAt }
    })
    .from(memberships)
    .innerJoin(children, eq(children.id, memberships.childId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(children.id));
  const childIds = childMemberships.map(({ child }) => child.id);

  if (rowLimit !== null) {
    const total = await countExportRows(db, childIds);
    if (total > rowLimit) {
      emitAudit?.({
        type: 'account.export_blocked',
        userId,
        reason: 'too_large',
        count: total,
        limit: rowLimit
      });
      throw new ExportTooLargeError(total, rowLimit);
    }
  }

  const { entries, symptomsByEntryId, meals, mealFoodNames, tips } = await loadChildRows(
    db,
    userId,
    childIds
  );
  const userPasskeys = await db
    .select({
      id: passkeys.id,
      name: passkeys.name,
      deviceType: passkeys.deviceType,
      backedUp: passkeys.backedUp,
      transports: rawJson(passkeys.transports),
      createdAt: passkeys.createdAt,
      lastUsedAt: passkeys.lastUsedAt
    })
    .from(passkeys)
    .where(eq(passkeys.userId, userId));
  const exportedInvitations = await loadInvitations(db, userId);

  const entriesByChildId = groupBy(entries, (e) => e.childId);
  const mealsByChildId = groupBy(meals, (meal) => meal.childId);

  emitAudit?.({ type: 'account.exported', userId, foodEntryCount: entries.length });

  return {
    exportedAt: new Date().toISOString(),
    generator: 'diversif',
    schemaVersion: 1,
    profile: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      tosAcceptedAt: isoOrNull(user.tosAcceptedAt),
      privacyAcceptedAt: isoOrNull(user.privacyAcceptedAt),
      ageConfirmedAt: isoOrNull(user.ageConfirmedAt),
      lastLoginAt: isoOrNull(user.lastLoginAt),
      lastExportAt: isoOrNull(user.lastExportAt)
    },
    children: childMemberships.map(({ child: c, membership: m }) => ({
      id: c.id,
      name: c.name,
      birthDate: c.birthDate,
      createdAt: c.createdAt.toISOString(),
      dietaryExclusions: parseDietExclusions(jsonArray(c.dietaryExclusions)),
      membership: { role: m.role, joinedAt: m.createdAt.toISOString() },
      foodEntries: (entriesByChildId.get(c.id) ?? []).map((e) => ({
        id: e.id,
        foodId: e.foodId,
        foodName: e.foodName,
        givenAt: e.givenAt.toISOString(),
        reaction: e.reaction,
        notes: e.notes,
        texture: e.texture ?? null,
        loggedByMe: e.loggedBy === userId,
        mealId: e.mealId ?? null,
        createdAt: e.createdAt.toISOString(),
        symptoms: (symptomsByEntryId.get(e.id) ?? []).map((s) => ({
          id: s.id,
          observedAt: s.observedAt.toISOString(),
          label: s.label,
          note: s.note,
          recordedByMe: s.createdBy === userId,
          createdAt: s.createdAt.toISOString()
        }))
      })),
      preparedMeals: (mealsByChildId.get(c.id) ?? []).map((meal) => ({
        id: meal.id,
        brand: meal.brand,
        name: meal.name,
        ingredients: meal.ingredientFoodIds.map((foodId) => ({
          foodId,
          foodName: mealFoodNames.get(foodId) ?? null
        })),
        lastUsedAt: isoOrNull(meal.lastUsedAt),
        createdAt: meal.createdAt.toISOString(),
        updatedAt: meal.updatedAt.toISOString()
      }))
    })),
    passkeys: userPasskeys.map((p) => ({
      id: p.id,
      name: p.name,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      // Kept as stored, as the browser reported them (see schema.ts).
      transports: jsonArray(p.transports) as string[],
      createdAt: p.createdAt.toISOString(),
      lastUsedAt: isoOrNull(p.lastUsedAt)
    })),
    invitations: exportedInvitations,
    tipDismissals: tips.map((t) => ({
      childId: t.childId,
      reminderKey: t.reminderKey,
      dismissedAt: t.dismissedAt.toISOString()
    }))
  };
}

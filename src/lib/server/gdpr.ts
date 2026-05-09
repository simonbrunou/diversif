import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from './db';
import {
  children,
  foodEntries,
  foods,
  memberships,
  passkeys,
  sessions,
  users,
  type Child,
  type FoodEntry,
  type Membership,
  type Passkey
} from './db/schema';

export type DeletionSummary = {
  deletedChildren: number;
  promotedMemberships: number;
  removedMemberships: number;
};

/**
 * Atomically deletes a user account.
 *
 * Per RGPD article 17 the deletion is immediate. We preserve data that other
 * members of a shared child still need: child rows survive when at least one
 * other member exists, and `food_entries.logged_by` becomes NULL via FK on
 * delete set null (the entry remains attached to the child). When the deleted
 * user is the sole owner of a shared child, the earliest remaining member by
 * `memberships.created_at` (tiebreak: lowest user_id) is promoted to owner.
 */
export async function deleteUserAccount(userId: number): Promise<DeletionSummary> {
  return db.transaction(async (tx) => {
    const summary: DeletionSummary = {
      deletedChildren: 0,
      promotedMemberships: 0,
      removedMemberships: 0
    };

    const userMemberships = await tx
      .select({ childId: memberships.childId, role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, userId));

    for (const m of userMemberships) {
      const others = await tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
          createdAt: memberships.createdAt
        })
        .from(memberships)
        .where(and(eq(memberships.childId, m.childId), ne(memberships.userId, userId)));

      if (others.length === 0) {
        await tx.delete(children).where(eq(children.id, m.childId));
        summary.deletedChildren += 1;
        continue;
      }

      if (m.role === 'owner') {
        const otherOwners = others.filter((o) => o.role === 'owner');
        if (otherOwners.length === 0) {
          const heir = [...others].sort((a, b) => {
            const ta = a.createdAt.getTime();
            const tb = b.createdAt.getTime();
            if (ta !== tb) return ta - tb;
            return a.userId - b.userId;
          })[0];
          await tx
            .update(memberships)
            .set({ role: 'owner' })
            .where(and(eq(memberships.childId, m.childId), eq(memberships.userId, heir.userId)));
          summary.promotedMemberships += 1;
        }
      }

      await tx
        .delete(memberships)
        .where(and(eq(memberships.childId, m.childId), eq(memberships.userId, userId)));
      summary.removedMemberships += 1;
    }

    // Explicitly drop every live session before the user row goes away.
    // The sessions FK has ON DELETE CASCADE so Postgres would do this for us,
    // but the explicit delete documents the intent — future moves of the
    // session store (Redis, etc.) would silently lose revocation otherwise.
    await tx.delete(sessions).where(eq(sessions.userId, userId));

    await tx.delete(users).where(eq(users.id, userId));

    return summary;
  });
}

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
  };
  children: Array<{
    id: number;
    name: string;
    birthDate: string;
    createdAt: string;
    membership: { role: Membership['role']; joinedAt: string };
    foodEntries: Array<{
      id: number;
      foodId: number;
      foodName: string;
      givenAt: string;
      reaction: FoodEntry['reaction'];
      notes: string | null;
      loggedByMe: boolean;
      createdAt: string;
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
};

// Hard ceiling on the number of food entries we'll serialise in a single
// export. The endpoint synchronously buffers the whole JSON payload in memory;
// without a guard rail, a pathologically-long log could OOM the process or
// blow past upstream proxy response limits. We do NOT silently truncate — if
// the count is over this, exportUserData throws ExportTooLargeError so the
// caller can surface an actionable error rather than handing the user an
// incomplete archive (which would breach RGPD article 15).
//
// 50k entries is well above any realistic user (≈9 years of daily logging
// and corresponds to ~12MB of JSON pre-pretty-print). If we ever see it
// hit in practice, the right fix is to stream the response, not to lower
// the cap.
export const EXPORT_FOOD_ENTRIES_LIMIT = 50_000;

export class ExportTooLargeError extends Error {
  readonly count: number;
  readonly limit: number;
  constructor(count: number, limit: number) {
    super(`Export too large: ${count} food entries exceeds limit of ${limit}`);
    this.name = 'ExportTooLargeError';
    this.count = count;
    this.limit = limit;
  }
}

// Drizzle's `timestamp_ms` mode always materializes timestamps as Date instances.
const isoOrNull = (v: Date | null | undefined): string | null =>
  v == null ? null : v.toISOString();

const isoOrThrow = (v: Date | null | undefined): string => {
  /* v8 ignore next */
  if (v == null) throw new Error('expected non-null timestamp');
  return v.toISOString();
};

/**
 * Builds the article 15 / 20 export payload for a user.
 *
 * Excluded by design: password hash, raw session ids, WebAuthn challenges,
 * passkey public keys and signature counters (security material with no
 * portability value to the user).
 *
 * Throws `ExportTooLargeError` if the user's food-entry count exceeds the
 * configured ceiling, so the caller can return a clear error rather than
 * serialise an incomplete archive. The `entryLimit` parameter exists for
 * tests; production callers should leave it on the default.
 */
export async function exportUserData(
  userId: number,
  entryLimit: number = EXPORT_FOOD_ENTRIES_LIMIT
): Promise<ExportedUser> {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) {
    throw new Error('User not found');
  }

  const userMemberships = await db.select().from(memberships).where(eq(memberships.userId, userId));

  const childIds = userMemberships.map((m) => m.childId);

  const childRows: Child[] =
    childIds.length === 0
      ? []
      : await db.select().from(children).where(inArray(children.id, childIds));

  // Count first so we can refuse oversize exports up front, instead of
  // silently truncating and handing the user an incomplete archive.
  if (childIds.length > 0) {
    const countRes = await db.execute<{ count: string }>(
      sql`SELECT COUNT(*)::text as count FROM ${foodEntries} WHERE ${inArray(foodEntries.childId, childIds)}`
    );
    /* v8 ignore next — pg COUNT(*) always returns a single row */
    const total = Number(countRes.rows[0]?.count ?? 0);
    if (total > entryLimit) {
      throw new ExportTooLargeError(total, entryLimit);
    }
  }

  const entryRows =
    childIds.length === 0
      ? []
      : await db
          .select({
            id: foodEntries.id,
            childId: foodEntries.childId,
            foodId: foodEntries.foodId,
            foodName: foods.name,
            givenAt: foodEntries.givenAt,
            reaction: foodEntries.reaction,
            notes: foodEntries.notes,
            loggedBy: foodEntries.loggedBy,
            createdAt: foodEntries.createdAt
          })
          .from(foodEntries)
          .innerJoin(foods, eq(foods.id, foodEntries.foodId))
          .where(inArray(foodEntries.childId, childIds))
          .orderBy(asc(foodEntries.givenAt));

  const userPasskeys = await db.select().from(passkeys).where(eq(passkeys.userId, userId));

  const membershipByChildId = new Map(userMemberships.map((m) => [m.childId, m]));
  const entriesByChildId = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const list = entriesByChildId.get(e.childId) ?? [];
    list.push(e);
    entriesByChildId.set(e.childId, list);
  }

  return {
    exportedAt: new Date().toISOString(),
    generator: 'diversif',
    schemaVersion: 1,
    profile: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: isoOrThrow(user.createdAt),
      tosAcceptedAt: isoOrNull(user.tosAcceptedAt),
      privacyAcceptedAt: isoOrNull(user.privacyAcceptedAt),
      ageConfirmedAt: isoOrNull(user.ageConfirmedAt),
      lastLoginAt: isoOrNull(user.lastLoginAt)
    },
    children: childRows.map((c) => {
      const m = membershipByChildId.get(c.id);
      const entries = entriesByChildId.get(c.id) ?? [];
      return {
        id: c.id,
        name: c.name,
        birthDate: c.birthDate,
        createdAt: isoOrThrow(c.createdAt),
        membership: {
          /* v8 ignore next */
          role: m?.role ?? 'member',
          /* v8 ignore next */
          joinedAt: m ? isoOrThrow(m.createdAt) : new Date(0).toISOString()
        },
        foodEntries: entries.map((e) => ({
          id: e.id,
          foodId: e.foodId,
          foodName: e.foodName,
          givenAt: isoOrThrow(e.givenAt),
          reaction: e.reaction,
          notes: e.notes,
          loggedByMe: e.loggedBy === userId,
          createdAt: isoOrThrow(e.createdAt)
        }))
      };
    }),
    passkeys: userPasskeys.map((p) => ({
      id: p.id,
      name: p.name,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      transports: p.transports,
      createdAt: isoOrThrow(p.createdAt),
      lastUsedAt: isoOrNull(p.lastUsedAt)
    }))
  };
}

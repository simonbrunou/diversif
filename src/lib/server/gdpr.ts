import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { db } from './db';
import { execRows } from './db/exec';
import { audit } from './audit';
import {
  children,
  foodEntries,
  foods,
  invitations,
  memberships,
  passkeys,
  sessions,
  tipDismissals,
  users,
  type Child,
  type FoodEntry,
  type Membership,
  type Passkey
} from './db/schema';
import type { TextureKey } from '$lib/utils/textures';
import { parseDietExclusions, type DietExclusion } from '$lib/utils/diet';

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
  const summary = db.transaction((tx) => {
    const summary: DeletionSummary = {
      deletedChildren: 0,
      promotedMemberships: 0,
      removedMemberships: 0
    };

    const userMemberships = tx
      .select({ childId: memberships.childId, role: memberships.role })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .all();

    for (const m of userMemberships) {
      const others = tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
          createdAt: memberships.createdAt
        })
        .from(memberships)
        .where(and(eq(memberships.childId, m.childId), ne(memberships.userId, userId)))
        .all();

      if (others.length === 0) {
        tx.delete(children).where(eq(children.id, m.childId)).run();
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
          tx.update(memberships)
            .set({ role: 'owner' })
            .where(and(eq(memberships.childId, m.childId), eq(memberships.userId, heir.userId)))
            .run();
          summary.promotedMemberships += 1;
        }
      }

      tx.delete(memberships)
        .where(and(eq(memberships.childId, m.childId), eq(memberships.userId, userId)))
        .run();
      summary.removedMemberships += 1;
    }

    // Explicitly drop every live session before the user row goes away.
    // The sessions FK has ON DELETE CASCADE so SQLite would do this for us,
    // but the explicit delete documents the intent : future moves of the
    // session store (Redis, etc.) would silently lose revocation otherwise.
    tx.delete(sessions).where(eq(sessions.userId, userId)).run();

    tx.delete(users).where(eq(users.id, userId)).run();

    return summary;
  });

  audit({ type: 'account.deleted', userId, ...summary });
  return summary;
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

// Hard ceiling on the number of food entries we'll serialise in a single
// export. The endpoint synchronously buffers the whole JSON payload in memory;
// without a guard rail, a pathologically-long log could OOM the process or
// blow past upstream proxy response limits. We do NOT silently truncate : if
// the count is over this, exportUserData throws ExportTooLargeError so the
// caller can surface an actionable error rather than handing the user an
// incomplete archive (which would breach RGPD article 15).
//
// 50k entries is well above any realistic user (≈9 years of daily logging
// and corresponds to ~12MB of JSON pre-pretty-print). If we ever see it
// hit in practice, the right fix is to stream the response, not to lower
// the cap.
const EXPORT_FOOD_ENTRIES_LIMIT = 50_000;

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
    const countRows = await execRows<{ count: string }>(
      db,
      sql`SELECT COUNT(*) as count FROM ${foodEntries} WHERE ${inArray(foodEntries.childId, childIds)}`
    );
    /* v8 ignore next : pg COUNT(*) always returns a single row */
    const total = Number(countRows[0]?.count ?? 0);
    if (total > entryLimit) {
      audit({
        type: 'account.export_blocked',
        userId,
        reason: 'too_large',
        count: total,
        limit: entryLimit
      });
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
            texture: foodEntries.texture,
            loggedBy: foodEntries.loggedBy,
            mealId: foodEntries.mealId,
            createdAt: foodEntries.createdAt
          })
          .from(foodEntries)
          .innerJoin(foods, eq(foods.id, foodEntries.foodId))
          .where(inArray(foodEntries.childId, childIds))
          .orderBy(asc(foodEntries.givenAt));

  const userPasskeys = await db.select().from(passkeys).where(eq(passkeys.userId, userId));

  // Invitations the user generated OR consumed. The `relationship` field
  // disambiguates the two so the same code (sent and later used by the
  // same user) shows up twice : that's the right semantic.
  const userInvitations = await db
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

  const exportedInvitations = userInvitations.flatMap((inv) => {
    const base = {
      childId: inv.childId,
      createdAt: isoOrThrow(inv.createdAt),
      expiresAt: isoOrThrow(inv.expiresAt),
      usedAt: isoOrNull(inv.usedAt)
    };
    const rows: ExportedUser['invitations'] = [];
    if (inv.createdBy === userId) {
      rows.push({ ...base, relationship: 'sent' });
    }
    if (inv.usedBy === userId) {
      rows.push({ ...base, relationship: 'accepted' });
    }
    return rows;
  });

  const userTipDismissals =
    childIds.length === 0
      ? []
      : await db
          .select({
            childId: tipDismissals.childId,
            reminderKey: tipDismissals.reminderKey,
            dismissedAt: tipDismissals.dismissedAt
          })
          .from(tipDismissals)
          .where(and(eq(tipDismissals.userId, userId), inArray(tipDismissals.childId, childIds)))
          .orderBy(asc(tipDismissals.dismissedAt));

  const membershipByChildId = new Map(userMemberships.map((m) => [m.childId, m]));
  const entriesByChildId = new Map<number, typeof entryRows>();
  for (const e of entryRows) {
    const list = entriesByChildId.get(e.childId) ?? [];
    list.push(e);
    entriesByChildId.set(e.childId, list);
  }

  audit({ type: 'account.exported', userId, foodEntryCount: entryRows.length });

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
      lastLoginAt: isoOrNull(user.lastLoginAt),
      lastExportAt: isoOrNull(user.lastExportAt)
    },
    children: childRows.map((c) => {
      const m = membershipByChildId.get(c.id);
      const entries = entriesByChildId.get(c.id) ?? [];
      return {
        id: c.id,
        name: c.name,
        birthDate: c.birthDate,
        createdAt: isoOrThrow(c.createdAt),
        dietaryExclusions: parseDietExclusions(c.dietaryExclusions),
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
          texture: e.texture ?? null,
          loggedByMe: e.loggedBy === userId,
          mealId: e.mealId ?? null,
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
    })),
    invitations: exportedInvitations,
    tipDismissals: userTipDismissals.map((t) => ({
      childId: t.childId,
      reminderKey: t.reminderKey,
      dismissedAt: isoOrThrow(t.dismissedAt)
    }))
  };
}

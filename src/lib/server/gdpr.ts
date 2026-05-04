import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { db } from './db';
import {
  children,
  foodEntries,
  foods,
  memberships,
  passkeys,
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
export function deleteUserAccount(userId: number): DeletionSummary {
  return db.transaction((tx) => {
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

    tx.delete(users).where(eq(users.id, userId)).run();

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
    transports: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
};

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
 */
export function exportUserData(userId: number): ExportedUser {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    throw new Error('User not found');
  }

  const userMemberships = db.select().from(memberships).where(eq(memberships.userId, userId)).all();

  const childIds = userMemberships.map((m) => m.childId);

  const childRows: Child[] =
    childIds.length === 0
      ? []
      : db.select().from(children).where(inArray(children.id, childIds)).all();

  const entryRows =
    childIds.length === 0
      ? []
      : db
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
          .orderBy(asc(foodEntries.givenAt))
          .all();

  const userPasskeys = db.select().from(passkeys).where(eq(passkeys.userId, userId)).all();

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

import { and, eq, ne } from 'drizzle-orm';
import { db } from './db';
import { audit } from './audit';
import { children, memberships, sessions, users } from './db/schema';

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

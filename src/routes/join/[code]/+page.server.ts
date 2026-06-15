import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { children, invitations, memberships, users } from '$lib/server/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { isValidInviteCodeFormat } from '$lib/utils/invites';
import { localizedRedirect } from '$lib/server/redirect';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

type ActiveInvite = {
  code: string;
  childId: number;
  childName: string;
  // null when the inviter's account was since deleted (createdBy → set null).
  inviterName: string | null;
};

const JOIN_INVITE_LOOKUP_LIMIT = {
  name: 'join-invite-lookup',
  limit: 20,
  windowMs: 5 * 60 * 1000
};

function checkJoinInviteLookupLimit(event: RequestEvent): string | null {
  const keys = [`ip:${clientKey(event)}`];
  if (event.locals.user) keys.push(`user:${event.locals.user.id}`);

  for (const key of keys) {
    const rl = checkRateLimit(JOIN_INVITE_LOOKUP_LIMIT, key);
    if (!rl.allowed) {
      return `Trop de tentatives. Réessayez dans ${rl.retryAfterSeconds}s.`;
    }
  }
  return null;
}

async function findActiveInvitation(code: string): Promise<ActiveInvite | null> {
  const row = (
    await db
      .select({
        code: invitations.code,
        childId: invitations.childId,
        childName: children.name,
        inviterName: users.displayName
      })
      .from(invitations)
      .innerJoin(children, eq(children.id, invitations.childId))
      .leftJoin(users, eq(users.id, invitations.createdBy))
      .where(
        and(
          eq(invitations.code, code),
          isNull(invitations.usedAt),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1)
  )[0];
  return row ?? null;
}

async function userHasMembership(userId: number, childId: number): Promise<boolean> {
  const row = (
    await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.childId, childId)))
      .limit(1)
  )[0];
  return !!row;
}

/**
 * GET only inspects state. The actual membership insert + invitation
 * consumption happens in the POST action below, so link previews / prefetches
 * cannot accidentally consume a one-shot code.
 */
export const load: PageServerLoad = async (event) => {
  const { params, locals } = event;
  const code = params.code.toUpperCase();

  if (!isValidInviteCodeFormat(code)) {
    return { error: 'Code d’invitation invalide.' as const, code, child: null, inviter: null };
  }

  if (!locals.user) {
    throw localizedRedirect(locals.locale, 303, `/signup?code=${encodeURIComponent(code)}`);
  }

  const limited = checkJoinInviteLookupLimit(event);
  if (limited) throw error(429, limited);

  const inv = await findActiveInvitation(code);
  if (!inv) {
    return {
      error: 'Code d’invitation introuvable ou expiré.' as const,
      code,
      child: null,
      inviter: null
    };
  }

  if (await userHasMembership(locals.user.id, inv.childId)) {
    throw localizedRedirect(locals.locale, 303, `/child/${inv.childId}`);
  }

  return {
    error: null,
    code,
    child: { id: inv.childId, name: inv.childName },
    inviter: inv.inviterName
  };
};

export const actions: Actions = {
  default: async (event) => {
    const { params, locals } = event;
    const code = params.code.toUpperCase();
    if (!isValidInviteCodeFormat(code)) {
      return fail(400, { error: 'Code d’invitation invalide.' });
    }
    if (!locals.user) {
      throw localizedRedirect(locals.locale, 303, `/signup?code=${encodeURIComponent(code)}`);
    }

    const limited = checkJoinInviteLookupLimit(event);
    if (limited) return fail(429, { error: limited });

    const inv = await findActiveInvitation(code);
    if (!inv) {
      return fail(400, { error: 'Code d’invitation introuvable ou expiré.' });
    }

    if (await userHasMembership(locals.user.id, inv.childId)) {
      throw localizedRedirect(locals.locale, 303, `/child/${inv.childId}`);
    }

    const now = new Date();
    // Atomic single-claim: race between two POSTs from different users would
    // otherwise both pass the read above and both insert membership rows
    // against the same one-shot code. Wrap the consumption in a transaction
    // and condition the invitation UPDATE on `used_at IS NULL`. If rowCount
    // is 0 someone else won the race and we abort the membership write.
    let consumed = false;
    db.transaction((tx) => {
      const result = tx
        .update(invitations)
        .set({ usedAt: now, usedBy: locals.user!.id })
        // Re-check expiry inside the claim alongside `usedAt IS NULL`: the
        // read in findActiveInvitation can't bind the row for the later write,
        // so an invite that expires between read and claim must still be
        // rejected here (defense-in-depth; the read→write gap is tiny under
        // bun:sqlite's synchronous transactions but the guard makes the
        // consume self-contained rather than time-of-check dependent).
        .where(
          and(
            eq(invitations.code, code),
            isNull(invitations.usedAt),
            gt(invitations.expiresAt, now)
          )
        )
        .returning({ code: invitations.code })
        .all();
      if (result.length === 0) return;
      tx.insert(memberships)
        .values({ userId: locals.user!.id, childId: inv.childId, role: 'member', createdAt: now })
        .run();
      consumed = true;
    });

    if (!consumed) {
      return fail(400, { error: 'Code d’invitation introuvable ou expiré.' });
    }

    audit({ type: 'invite.redeemed', userId: locals.user.id, childId: inv.childId });
    throw localizedRedirect(locals.locale, 303, `/child/${inv.childId}`);
  }
};

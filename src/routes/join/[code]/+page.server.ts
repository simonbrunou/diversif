import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { children, invitations, memberships } from '$lib/server/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { isValidInviteCodeFormat } from '$lib/utils/invites';
import { localizedRedirect } from '$lib/server/redirect';
import type { Actions, PageServerLoad } from './$types';

type ActiveInvite = {
  code: string;
  childId: number;
  childName: string;
};

async function findActiveInvitation(code: string): Promise<ActiveInvite | null> {
  const row = (
    await db
      .select({
        code: invitations.code,
        childId: invitations.childId,
        childName: children.name
      })
      .from(invitations)
      .innerJoin(children, eq(children.id, invitations.childId))
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
export const load: PageServerLoad = async ({ params, locals }) => {
  const code = params.code.toUpperCase();

  if (!isValidInviteCodeFormat(code)) {
    return { error: 'Code d’invitation invalide.' as const, code, child: null };
  }

  if (!locals.user) {
    throw localizedRedirect(locals.locale, 303, `/signup?code=${encodeURIComponent(code)}`);
  }

  const inv = await findActiveInvitation(code);
  if (!inv) {
    return { error: 'Code d’invitation introuvable ou expiré.' as const, code, child: null };
  }

  if (await userHasMembership(locals.user.id, inv.childId)) {
    throw localizedRedirect(locals.locale, 303, `/child/${inv.childId}`);
  }

  return {
    error: null,
    code,
    child: { id: inv.childId, name: inv.childName }
  };
};

export const actions: Actions = {
  default: async ({ params, locals }) => {
    const code = params.code.toUpperCase();
    if (!isValidInviteCodeFormat(code)) {
      return fail(400, { error: 'Code d’invitation invalide.' });
    }
    if (!locals.user) {
      throw localizedRedirect(locals.locale, 303, `/signup?code=${encodeURIComponent(code)}`);
    }

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
    await db.transaction(async (tx) => {
      const result = await tx
        .update(invitations)
        .set({ usedAt: now, usedBy: locals.user!.id })
        .where(and(eq(invitations.code, code), isNull(invitations.usedAt)));
      /* v8 ignore next : node-postgres always populates rowCount for UPDATE */
      if ((result.rowCount ?? 0) === 0) return;
      await tx
        .insert(memberships)
        .values({ userId: locals.user!.id, childId: inv.childId, role: 'member', createdAt: now });
      consumed = true;
    });

    if (!consumed) {
      return fail(400, { error: 'Code d’invitation introuvable ou expiré.' });
    }

    throw localizedRedirect(locals.locale, 303, `/child/${inv.childId}`);
  }
};

import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { children, invitations, memberships } from '$lib/server/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { isValidInviteCodeFormat } from '$lib/utils/invites';
import type { Actions, PageServerLoad } from './$types';

type ActiveInvite = {
  code: string;
  childId: number;
  childName: string;
};

function findActiveInvitation(code: string): ActiveInvite | null {
  const row = db
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
    .get();
  return row ?? null;
}

function userHasMembership(userId: number, childId: number): boolean {
  return !!db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.childId, childId)))
    .get();
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
    throw redirect(303, `/signup?code=${encodeURIComponent(code)}`);
  }

  const inv = findActiveInvitation(code);
  if (!inv) {
    return { error: 'Code d’invitation introuvable ou expiré.' as const, code, child: null };
  }

  if (userHasMembership(locals.user.id, inv.childId)) {
    throw redirect(303, `/child/${inv.childId}`);
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
      throw redirect(303, `/signup?code=${encodeURIComponent(code)}`);
    }

    const inv = findActiveInvitation(code);
    if (!inv) {
      return fail(400, { error: 'Code d’invitation introuvable ou expiré.' });
    }

    if (userHasMembership(locals.user.id, inv.childId)) {
      throw redirect(303, `/child/${inv.childId}`);
    }

    const now = new Date();
    db.insert(memberships)
      .values({ userId: locals.user.id, childId: inv.childId, role: 'member', createdAt: now })
      .run();
    db.update(invitations)
      .set({ usedAt: now, usedBy: locals.user.id })
      .where(eq(invitations.code, code))
      .run();

    throw redirect(303, `/child/${inv.childId}`);
  }
};

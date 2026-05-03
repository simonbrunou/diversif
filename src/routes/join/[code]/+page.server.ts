import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { invitations, memberships } from '$lib/server/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { isValidInviteCodeFormat } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const code = params.code.toUpperCase();

  if (!isValidInviteCodeFormat(code)) {
    throw redirect(303, '/login');
  }

  if (!locals.user) {
    throw redirect(303, `/signup?code=${encodeURIComponent(code)}`);
  }

  const inv = db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.code, code),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .get();

  if (!inv) {
    return { error: 'Code d’invitation introuvable ou expiré.' as const };
  }

  const existing = db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, locals.user.id), eq(memberships.childId, inv.childId)))
    .get();

  if (existing) {
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
};

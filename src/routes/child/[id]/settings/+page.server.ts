import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, invitations, memberships, users } from '$lib/server/db/schema';
import { generateInviteCodeRaw } from '$lib/server/auth';
import { requireMembership, requireOwnership } from '$lib/server/guards';
import { isValidBirthDate } from '$lib/utils/dates';
import type { Actions, PageServerLoad } from './$types';

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

/* v8 ignore start — defensive helper: iterations 2..5 are unreachable
   without a deterministic mock (collision odds are 1/32^4 per try). */
async function generateUniqueInviteCode(): Promise<string | null> {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCodeRaw();
    const existing = (
      await db.select().from(invitations).where(eq(invitations.code, code)).limit(1)
    )[0];
    if (!existing) return code;
  }
  return null;
}
/* v8 ignore stop */

export const load: PageServerLoad = async ({ params, locals }) => {
  const childId = Number(params.id);
  const { membership } = requireMembership(locals, childId);

  const memberRows = await db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      displayName: users.displayName,
      email: users.email
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.childId, childId));

  const activeInvites = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.childId, childId),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date())
      )
    );

  return {
    members: memberRows.map((m) => ({
      ...m,
      // Drizzle's timestamp_ms mode always materializes timestamps as Date.
      createdAt: (m.createdAt as Date).getTime()
    })),
    invitations: activeInvites.map((i) => ({
      code: i.code,
      expiresAt: (i.expiresAt as Date).getTime()
    })),
    role: membership.role
  };
};

const updateSchema = z.object({
  name: z.string().min(1).max(80),
  birthDate: z.string().refine(isValidBirthDate, 'Date invalide')
});

export const actions: Actions = {
  updateChild: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);
    const raw = Object.fromEntries(await request.formData());
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) return fail(400, { error: 'Champs invalides.' });

    await db
      .update(children)
      .set({ name: parsed.data.name.trim(), birthDate: parsed.data.birthDate })
      .where(eq(children.id, childId));
    return { success: 'Enfant mis à jour.' };
  },

  createInvitation: async ({ params, locals }) => {
    const childId = Number(params.id);
    const { user } = requireOwnership(locals, childId);

    const code = await generateUniqueInviteCode();
    /* v8 ignore next — astronomical 1/32^16 probability after 5 attempts */
    if (!code) return fail(500, { error: 'Impossible de générer un code unique.' });

    const now = new Date();
    await db.insert(invitations).values({
      code,
      childId,
      createdBy: user.id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_DURATION_MS),
      usedAt: null,
      usedBy: null
    });
    return { success: 'Code généré.', code };
  },

  revokeInvitation: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);
    const data = await request.formData();
    const code = String(data.get('code') ?? '');
    if (!code) return fail(400, { error: 'Code manquant.' });
    await db
      .delete(invitations)
      .where(and(eq(invitations.code, code), eq(invitations.childId, childId)));
    return { success: 'Invitation révoquée.' };
  },

  removeMember: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    const { user: owner } = requireOwnership(locals, childId);
    const data = await request.formData();
    const userId = Number(data.get('userId'));
    if (!Number.isInteger(userId)) return fail(400, { error: 'Utilisateur invalide.' });
    if (userId === owner.id)
      return fail(400, { error: 'Vous ne pouvez pas vous retirer vous-même.' });

    await db
      .delete(memberships)
      .where(and(eq(memberships.childId, childId), eq(memberships.userId, userId)));
    return { success: 'Membre retiré.' };
  },

  leaveChild: async ({ params, locals }) => {
    const childId = Number(params.id);
    const { user, membership } = requireMembership(locals, childId);
    if (membership.role === 'owner') {
      return fail(400, {
        error: 'Le créateur ne peut pas quitter, supprimez l’enfant à la place.'
      });
    }
    await db
      .delete(memberships)
      .where(and(eq(memberships.childId, childId), eq(memberships.userId, user.id)));
    throw redirect(303, '/');
  },

  deleteChild: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);

    const data = await request.formData();
    const confirmName = String(data.get('confirmName') ?? /* v8 ignore next */ '').trim();
    const child = (await db.select().from(children).where(eq(children.id, childId)).limit(1))[0];
    if (!child) throw redirect(303, '/');
    if (confirmName !== child.name) {
      return fail(400, { error: 'Saisissez le prénom exact pour confirmer.' });
    }

    await db.delete(children).where(eq(children.id, childId));
    throw redirect(303, '/');
  }
};

import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, invitations, memberships, users } from '$lib/server/db/schema';
import { generateInviteCodeRaw } from '$lib/server/auth';
import { requireMembership, requireOwnership, requireUser } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export const load: PageServerLoad = async ({ params, locals }) => {
  const childId = Number(params.id);
  requireUser(locals);
  const membership = requireMembership(locals, childId);

  const memberRows = db
    .select({
      userId: memberships.userId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      displayName: users.displayName,
      email: users.email
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.childId, childId))
    .all();

  const activeInvites = db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.childId, childId),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date())
      )
    )
    .all();

  return {
    members: memberRows.map((m) => ({
      ...m,
      createdAt: m.createdAt instanceof Date ? m.createdAt.getTime() : Number(m.createdAt)
    })),
    invitations: activeInvites.map((i) => ({
      code: i.code,
      expiresAt: i.expiresAt instanceof Date ? i.expiresAt.getTime() : Number(i.expiresAt)
    })),
    role: membership.role
  };
};

const updateSchema = z.object({
  name: z.string().min(1).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const actions: Actions = {
  updateChild: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);
    const raw = Object.fromEntries(await request.formData());
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) return fail(400, { error: 'Champs invalides.' });

    db.update(children)
      .set({ name: parsed.data.name.trim(), birthDate: parsed.data.birthDate })
      .where(eq(children.id, childId))
      .run();
    return { success: 'Enfant mis à jour.' };
  },

  createInvitation: async ({ params, locals }) => {
    const user = requireUser(locals);
    const childId = Number(params.id);
    requireOwnership(locals, childId);

    let attempts = 0;
    while (attempts < 5) {
      const code = generateInviteCodeRaw();
      const existing = db.select().from(invitations).where(eq(invitations.code, code)).get();
      if (!existing) {
        const now = new Date();
        db.insert(invitations)
          .values({
            code,
            childId,
            createdBy: user.id,
            createdAt: now,
            expiresAt: new Date(now.getTime() + INVITE_DURATION_MS),
            usedAt: null,
            usedBy: null
          })
          .run();
        return { success: 'Code généré.', code };
      }
      attempts += 1;
    }
    return fail(500, { error: 'Impossible de générer un code unique.' });
  },

  revokeInvitation: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);
    const data = await request.formData();
    const code = String(data.get('code') ?? '');
    if (!code) return fail(400, { error: 'Code manquant.' });
    db.delete(invitations)
      .where(and(eq(invitations.code, code), eq(invitations.childId, childId)))
      .run();
    return { success: 'Invitation révoquée.' };
  },

  removeMember: async ({ params, request, locals }) => {
    const owner = requireUser(locals);
    const childId = Number(params.id);
    requireOwnership(locals, childId);
    const data = await request.formData();
    const userId = Number(data.get('userId'));
    if (!Number.isInteger(userId)) return fail(400, { error: 'Utilisateur invalide.' });
    if (userId === owner.id)
      return fail(400, { error: 'Vous ne pouvez pas vous retirer vous-même.' });

    db.delete(memberships)
      .where(and(eq(memberships.childId, childId), eq(memberships.userId, userId)))
      .run();
    return { success: 'Membre retiré.' };
  },

  leaveChild: async ({ params, locals }) => {
    const user = requireUser(locals);
    const childId = Number(params.id);
    const membership = requireMembership(locals, childId);
    if (membership.role === 'owner') {
      return fail(400, {
        error: 'Le créateur ne peut pas quitter, supprimez l’enfant à la place.'
      });
    }
    db.delete(memberships)
      .where(and(eq(memberships.childId, childId), eq(memberships.userId, user.id)))
      .run();
    throw redirect(303, '/');
  },

  deleteChild: async ({ params, request, locals }) => {
    const childId = Number(params.id);
    requireOwnership(locals, childId);

    const data = await request.formData();
    const confirmName = String(data.get('confirmName') ?? '').trim();
    const child = db.select().from(children).where(eq(children.id, childId)).get();
    if (!child) throw redirect(303, '/');
    if (confirmName !== child.name) {
      return fail(400, { error: 'Saisissez le prénom exact pour confirmer.' });
    }

    db.delete(children).where(eq(children.id, childId)).run();
    throw redirect(303, '/');
  }
};

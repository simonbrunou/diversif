import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, invitations, memberships, users } from '$lib/server/db/schema';
import { createInvitationForChild } from '$lib/server/invitations';
import { requireFreshAuth } from '$lib/server/fresh-auth';
import {
  parseChildIdParam,
  requireChildContext,
  requireOwnership,
  requireUser
} from '$lib/server/guards';
import { isValidBirthDate } from '$lib/utils/dates';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const { childId, membership } = requireChildContext(locals, params);

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

  // Owners need email to identify which co-parent to remove from the roster
  // (administrative use). Non-owner members get displayName only : exposing
  // every co-parent's email to every newly-joined member is a PII leak with
  // no operational need.
  const isOwner = membership.role === 'owner';

  return {
    members: memberRows.map((m) => ({
      userId: m.userId,
      role: m.role,
      displayName: m.displayName,
      email: isOwner ? m.email : null,
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
    requireUser(locals);
    const childId = parseChildIdParam(params);
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

  createInvitation: async ({ params, request, locals }) => {
    requireUser(locals);
    const childId = parseChildIdParam(params);
    const { user } = requireOwnership(locals, childId);
    const data = await request.formData();
    const currentPassword = String(data.get('currentPassword') ?? '');

    const fresh = await requireFreshAuth(user, currentPassword, {
      onMissingUser: () => {
        throw localizedRedirect(locals.locale, 303, '/login');
      }
    });
    if (!fresh.ok) return fresh.error;

    const code = await createInvitationForChild({ childId, createdBy: user.id });
    if (!code) return fail(500, { error: 'Impossible de générer un code unique.' });
    return { success: 'Code généré.', code };
  },

  revokeInvitation: async ({ params, request, locals }) => {
    requireUser(locals);
    const childId = parseChildIdParam(params);
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
    requireUser(locals);
    const childId = parseChildIdParam(params);
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
    const { user, childId, membership } = requireChildContext(locals, params);
    if (membership.role === 'owner') {
      return fail(400, {
        error: 'Le créateur ne peut pas quitter, supprimez l’enfant à la place.'
      });
    }
    await db
      .delete(memberships)
      .where(and(eq(memberships.childId, childId), eq(memberships.userId, user.id)));
    throw localizedRedirect(locals.locale, 303, '/');
  },

  deleteChild: async ({ params, request, locals }) => {
    requireUser(locals);
    const childId = parseChildIdParam(params);
    const { user } = requireOwnership(locals, childId);

    const data = await request.formData();
    const confirmText = String(data.get('confirmText') ?? /* v8 ignore next */ '').trim();
    const currentPassword = String(data.get('currentPassword') ?? /* v8 ignore next */ '');
    const child = (await db.select().from(children).where(eq(children.id, childId)).limit(1))[0];
    if (!child) throw localizedRedirect(locals.locale, 303, '/');
    if (confirmText !== child.name) {
      return fail(400, { error: 'Saisissez le prénom exact pour confirmer.' });
    }

    // Fresh-auth: typed name is visible on the page; require the current
    // password as proof the request comes from the owner, not a stolen
    // session cookie. `onMissingUser` localizes the /login redirect on the
    // rare race where the owner row vanished between requireOwnership and
    // now (helper would otherwise throw a plain Error → unhandled 500).
    const fresh = await requireFreshAuth(user, currentPassword, {
      onMissingUser: () => {
        throw localizedRedirect(locals.locale, 303, '/login');
      }
    });
    if (!fresh.ok) return fresh.error;

    await db.delete(children).where(eq(children.id, childId));
    throw localizedRedirect(locals.locale, 303, '/');
  }
};

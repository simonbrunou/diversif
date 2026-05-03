import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
  SESSION_COOKIE,
  hashPassword,
  invalidateAllUserSessions,
  verifyPassword
} from '$lib/server/auth';
import { requireUser } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

const profileSchema = z.object({
  displayName: z.string().min(1).max(80)
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)')
});

export const actions: Actions = {
  updateProfile: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) return fail(400, { profileError: 'Nom invalide.' });
    db.update(users)
      .set({ displayName: parsed.data.displayName.trim() })
      .where(eq(users.id, user.id))
      .run();
    return { profileSuccess: 'Profil mis à jour.' };
  },

  changePassword: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const parsed = passwordSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, { passwordError: parsed.error.issues[0]?.message ?? 'Champs invalides.' });
    }
    const fresh = db.select().from(users).where(eq(users.id, user.id)).get();
    if (!fresh) throw redirect(303, '/login');
    const ok = await verifyPassword(fresh.passwordHash, parsed.data.currentPassword);
    if (!ok) return fail(400, { passwordError: 'Mot de passe actuel incorrect.' });
    const newHash = await hashPassword(parsed.data.newPassword);
    db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id)).run();
    return { passwordSuccess: 'Mot de passe modifié.' };
  },

  logoutEverywhere: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    invalidateAllUserSessions(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  }
};

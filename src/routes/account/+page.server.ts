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
import { deletePasskey, listPasskeys, publicPasskey, renamePasskey } from '$lib/server/passkeys';
import { deleteUserAccount } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireUser(locals);
  return {
    passkeys: (await listPasskeys(user.id)).map(publicPasskey)
  };
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
    if (!parsed.success) return fail(400, { profileErrorKey: 'errorsAccountProfileNameInvalid' });
    await db
      .update(users)
      .set({ displayName: parsed.data.displayName.trim() })
      .where(eq(users.id, user.id));
    return { profileSuccessKey: 'errorsAccountProfileSuccess' };
  },

  changePassword: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const parsed = passwordSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        passwordErrorKey: 'errorsAuthBadInput'
      });
    }
    const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
    if (!fresh) throw redirect(303, '/login');
    const ok = await verifyPassword(fresh.passwordHash, parsed.data.currentPassword);
    if (!ok) return fail(400, { passwordErrorKey: 'errorsAccountPasswordIncorrect' });
    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
    return { passwordSuccessKey: 'errorsAccountPasswordSuccess' };
  },

  logoutEverywhere: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    await invalidateAllUserSessions(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/login');
  },

  renamePasskey: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const id = typeof raw.id === 'string' ? raw.id : /* v8 ignore next */ '';
    const name = typeof raw.name === 'string' ? raw.name : /* v8 ignore next */ '';
    if (!id || !name.trim()) {
      return fail(400, { passkeyErrorKey: 'errorsAccountPasskeyNameInvalid' });
    }
    if (!(await renamePasskey(user.id, id, name))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    return { passkeySuccessKey: 'errorsAccountPasskeyRenameSuccess' };
  },

  deletePasskey: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const id = typeof raw.id === 'string' ? raw.id : /* v8 ignore next */ '';
    if (!id) {
      return fail(400, { passkeyErrorKey: 'errorsAccountPasskeyIdMissing' });
    }
    if (!(await deletePasskey(user.id, id))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    return { passkeySuccessKey: 'errorsAccountPasskeyDeleteSuccess' };
  },

  deleteAccount: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const confirmEmail =
      typeof raw.confirmEmail === 'string' ? raw.confirmEmail.trim().toLowerCase() : '';
    if (confirmEmail !== user.email) {
      return fail(400, { deleteErrorKey: 'errorsAccountDeleteEmailMismatch' });
    }
    await deleteUserAccount(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw redirect(303, '/account/deleted');
  }
};

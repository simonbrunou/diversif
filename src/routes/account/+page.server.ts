import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  createSession,
  hashPassword,
  invalidateAllUserSessions,
  verifyPassword
} from '$lib/server/auth';
import { deletePasskey, listPasskeys, publicPasskey, renamePasskey } from '$lib/server/passkeys';
import { deleteUserAccount } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import { checkRateLimit } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

// Both actions take a currentPassword and run it through argon2id. Without a
// cap, a stolen session cookie can brute-force the password field at full
// speed — the KDF cost is the only brake. Key on user.id (not IP) because
// the legitimate user is necessarily authenticated, and the threat is a
// stolen session that may move across IPs. 5 attempts per 5 minutes is
// generous for a real user fat-fingering and tight enough to make
// password-stuffing pointless.
const FRESH_AUTH_LIMIT = { name: 'fresh-auth', limit: 5, windowMs: 5 * 60 * 1000 };

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

  changePassword: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const rl = checkRateLimit(FRESH_AUTH_LIMIT, String(user.id));
    if (!rl.allowed) {
      return fail(429, { passwordErrorKey: 'errorsAuthRateLimited' });
    }
    const raw = Object.fromEntries(await request.formData());
    const parsed = passwordSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        passwordErrorKey: 'errorsAuthBadInput'
      });
    }
    const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
    if (!fresh) throw localizedRedirect(locals.locale, 303, '/login');
    const ok = await verifyPassword(fresh.passwordHash, parsed.data.currentPassword);
    if (!ok) return fail(400, { passwordErrorKey: 'errorsAccountPasswordIncorrect' });
    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Rotate sessions: drop every existing session (including any stolen cookie
    // an attacker might already hold) and re-issue one for this tab so the user
    // stays logged in on the device they just used to change their password.
    await invalidateAllUserSessions(user.id);
    const session = await createSession(user.id);
    cookies.set(SESSION_COOKIE, session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    });

    return { passwordSuccessKey: 'errorsAccountPasswordSuccess' };
  },

  logoutEverywhere: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    await invalidateAllUserSessions(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw localizedRedirect(locals.locale, 303, '/login');
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
    const rl = checkRateLimit(FRESH_AUTH_LIMIT, String(user.id));
    if (!rl.allowed) {
      return fail(429, { deleteErrorKey: 'errorsAuthRateLimited' });
    }
    const raw = Object.fromEntries(await request.formData());
    const confirmEmail =
      typeof raw.confirmEmail === 'string' ? raw.confirmEmail.trim().toLowerCase() : '';
    const currentPassword = typeof raw.currentPassword === 'string' ? raw.currentPassword : '';
    if (confirmEmail !== user.email) {
      return fail(400, { deleteErrorKey: 'errorsAccountDeleteEmailMismatch' });
    }
    // Fresh-auth: typed email is visible on the page, so a stolen session
    // cookie alone shouldn't be enough to permanently destroy the account.
    // Require the current password as proof the request comes from the owner.
    const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
    if (!fresh) throw localizedRedirect(locals.locale, 303, '/login');
    const ok = currentPassword ? await verifyPassword(fresh.passwordHash, currentPassword) : false;
    if (!ok) {
      return fail(400, { deleteErrorKey: 'errorsAccountPasswordIncorrect' });
    }
    await deleteUserAccount(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw localizedRedirect(locals.locale, 303, '/account/deleted');
  }
};

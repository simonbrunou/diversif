import { localizedRedirect } from '#lib/server/redirect.js';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
  createSession,
  hashPassword,
  invalidateAllUserSessions,
  PASSWORD_MIN_LENGTH,
  setSessionCookie
} from '#lib/server/auth.js';
import { requireUser } from '#lib/server/guards.js';
import { parseFormWithKey } from '#lib/server/forms.js';
import { requireFreshAuthWithKey } from '#lib/server/fresh-auth.js';
import { audit } from '#lib/server/audit.js';
import type { Actions, PageServerLoad } from './$types';

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Mot de passe trop court (${PASSWORD_MIN_LENGTH} caractères minimum)`)
});

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);

    const parsed = await parseFormWithKey(request, passwordSchema, {
      field: 'passwordErrorKey',
      badInputKey: 'errorsAuthBadInput'
    });
    if (!parsed.ok) return parsed.failure;

    const fresh = await requireFreshAuthWithKey(user, parsed.data.currentPassword, {
      field: 'passwordErrorKey',
      rateLimitedKey: 'errorsAuthRateLimited',
      incorrectKey: 'errorsAccountPasswordIncorrect',
      onMissingUser: () => {
        throw localizedRedirect(locals.locale, 303, '/login');
      }
    });
    if (!fresh.ok) return fresh.failure;

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Drop every existing session (including the attacker's stolen cookie if
    // any) and re-issue one for this tab so the user stays logged in on the
    // device they used to change their password.
    await invalidateAllUserSessions(user.id);
    const { token } = await createSession(user.id);
    setSessionCookie(cookies, token);

    audit({ type: 'account.password_changed', userId: user.id });
    return { passwordSuccessKey: 'errorsAccountPasswordSuccess' };
  }
};

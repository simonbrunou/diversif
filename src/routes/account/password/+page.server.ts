import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
  createSession,
  hashPassword,
  invalidateAllUserSessions,
  setSessionCookie,
  verifyPassword
} from '$lib/server/auth';
import { requireUser } from '$lib/server/guards';
import { checkRateLimit } from '$lib/server/rate-limit';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

// Argon2id costs are the only brake on a stolen-cookie brute force on
// currentPassword. Keyed on user.id so the rate limit follows the threat
// (a session moving between IPs) rather than IP itself. 5 per 5 minutes is
// comfortable for fat-fingers and tight enough to make stuffing pointless.
const FRESH_AUTH_LIMIT = { name: 'fresh-auth', limit: 5, windowMs: 5 * 60 * 1000 };

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)')
});

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const rl = checkRateLimit(FRESH_AUTH_LIMIT, String(user.id));
    if (!rl.allowed) {
      return fail(429, { passwordErrorKey: 'errorsAuthRateLimited' });
    }
    const raw = Object.fromEntries(await request.formData());
    const parsed = passwordSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, { passwordErrorKey: 'errorsAuthBadInput' });
    }
    const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
    if (!fresh) throw localizedRedirect(locals.locale, 303, '/login');
    const ok = await verifyPassword(fresh.passwordHash, parsed.data.currentPassword);
    if (!ok) return fail(400, { passwordErrorKey: 'errorsAccountPasswordIncorrect' });
    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    // Drop every existing session (including the attacker's stolen cookie if
    // any) and re-issue one for this tab so the user stays logged in on the
    // device they used to change their password.
    await invalidateAllUserSessions(user.id);
    const session = await createSession(user.id);
    setSessionCookie(cookies, session.id);

    audit({ type: 'account.password_changed', userId: user.id });
    return { passwordSuccessKey: 'errorsAccountPasswordSuccess' };
  }
};

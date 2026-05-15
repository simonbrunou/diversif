import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { SESSION_COOKIE, verifyPassword } from '$lib/server/auth';
import { deleteUserAccount } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import { checkRateLimit } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const FRESH_AUTH_LIMIT = { name: 'fresh-auth', limit: 5, windowMs: 5 * 60 * 1000 };

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
    const rl = checkRateLimit(FRESH_AUTH_LIMIT, String(user.id));
    if (!rl.allowed) {
      return fail(429, { deleteErrorKey: 'errorsAuthRateLimited' });
    }
    const raw = Object.fromEntries(await request.formData());
    const confirmEmail =
      typeof raw.confirmEmail === 'string' ? raw.confirmEmail.trim().toLowerCase() : '';
    const currentPassword = typeof raw.currentPassword === 'string' ? raw.currentPassword : '';
    // Lowercase both sides: signup normalises to lowercase before insert, but
    // the DB column has no CITEXT/CHECK constraint forcing it, so any account
    // that ever bypassed signup (manual import, future paths) could have
    // mixed-case email and lock the user out of their own deletion.
    if (confirmEmail !== user.email.toLowerCase()) {
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

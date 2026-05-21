import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { SESSION_COOKIE } from '$lib/server/auth';
import { deleteUserAccount } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import { requireFreshAuthWithKey } from '$lib/server/fresh-auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const user = requireUser(locals);
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
    const fresh = await requireFreshAuthWithKey(user, currentPassword, {
      field: 'deleteErrorKey',
      rateLimitedKey: 'errorsAuthRateLimited',
      incorrectKey: 'errorsAccountPasswordIncorrect',
      onMissingUser: () => {
        throw localizedRedirect(locals.locale, 303, '/login');
      }
    });
    if (!fresh.ok) return fresh.failure;

    await deleteUserAccount(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    throw localizedRedirect(locals.locale, 303, '/account/deleted');
  }
};

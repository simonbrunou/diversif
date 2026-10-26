import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '#lib/server/redirect.js';
import { endSession } from '#lib/server/session.js';
import { deleteUserAccount } from '#lib/server/gdpr.js';
import { requireUser } from '#lib/server/guards.js';
import { requireFreshAuth } from '#lib/server/fresh-auth.js';
import { matchesAccountEmail } from '#lib/utils/account-email.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const { request, locals } = event;
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const confirmEmail = typeof raw.confirmEmail === 'string' ? raw.confirmEmail : '';
    const currentPassword = typeof raw.currentPassword === 'string' ? raw.currentPassword : '';
    if (!matchesAccountEmail(confirmEmail, user.email)) {
      return fail(400, { deleteErrorKey: 'errorsAccountDeleteEmailMismatch', confirmEmail });
    }
    // Fresh-auth: typed email is visible on the page, so a stolen session
    // cookie alone shouldn't be enough to permanently destroy the account.
    // Require the current password as proof the request comes from the owner.
    const fresh = await requireFreshAuth(locals, currentPassword, 'deleteErrorKey');
    if (!fresh.ok) return fail(fresh.failure.status, { ...fresh.failure.data, confirmEmail });

    await deleteUserAccount(user.id);
    await endSession(event);
    throw localizedRedirect(locals.locale, 303, '/account/deleted');
  }
};

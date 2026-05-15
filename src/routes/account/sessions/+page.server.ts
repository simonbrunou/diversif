import { localizedRedirect } from '$lib/server/redirect';
import { SESSION_COOKIE, invalidateAllUserSessions } from '$lib/server/auth';
import { requireUser } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  logoutEverywhere: async ({ locals, cookies }) => {
    const user = requireUser(locals);
    await invalidateAllUserSessions(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    audit({ type: 'account.sessions_revoked', userId: user.id });
    throw localizedRedirect(locals.locale, 303, '/login');
  }
};

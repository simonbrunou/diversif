import { localizedRedirect } from '#lib/server/redirect.js';
import { endAllSessions } from '#lib/server/session.js';
import { requireUser } from '#lib/server/guards.js';
import { audit } from '#lib/server/audit.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  logoutEverywhere: async (event) => {
    const user = requireUser(event.locals);
    await endAllSessions(event, user.id);
    audit({ type: 'account.sessions_revoked', userId: user.id });
    throw localizedRedirect(event.locals.locale, 303, '/login');
  }
};

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
  logoutEverywhere: async ({ locals, cookies, setHeaders }) => {
    const user = requireUser(locals);
    await invalidateAllUserSessions(user.id);
    cookies.delete(SESSION_COOKIE, { path: '/' });
    audit({ type: 'account.sessions_revoked', userId: user.id });
    // Same shared-device hygiene as POST /logout : clear CacheStorage,
    // IndexedDB and the SW registration alongside the redirect (the header
    // rides on the 303). Safari doesn't honour Clear-Site-Data reliably, so
    // the form also purges client-side before submitting.
    setHeaders({ 'Clear-Site-Data': '"cache", "storage"' });
    throw localizedRedirect(locals.locale, 303, '/login');
  }
};

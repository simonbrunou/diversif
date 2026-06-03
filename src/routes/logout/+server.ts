import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import { localizedRedirect } from '$lib/server/redirect';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  if (locals.sessionId) {
    await invalidateSession(locals.sessionId);
    if (locals.user) audit({ type: 'auth.logout', userId: locals.user.id });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw localizedRedirect(locals.locale, 303, '/login');
};

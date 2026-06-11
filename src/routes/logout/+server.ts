import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import { localizedRedirect } from '$lib/server/redirect';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  // invalidateSession expects the RAW cookie token (it hashes before the DB
  // delete); locals.sessionId holds the stored sha256 digest, which would
  // be double-hashed and never match a row.
  const token = cookies.get(SESSION_COOKIE);
  if (token) {
    await invalidateSession(token);
    if (locals.user) audit({ type: 'auth.logout', userId: locals.user.id });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw localizedRedirect(locals.locale, 303, '/login');
};

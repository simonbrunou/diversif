import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import { localizedRedirect } from '$lib/server/redirect';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  if (locals.sessionId) {
    await invalidateSession(locals.sessionId);
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw localizedRedirect(locals.locale, 303, '/login');
};

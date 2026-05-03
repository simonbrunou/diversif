import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  if (locals.sessionId) {
    invalidateSession(locals.sessionId);
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/login');
};

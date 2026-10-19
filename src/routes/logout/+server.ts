import { endSession } from '#lib/server/session.js';
import { localizedRedirect } from '#lib/server/redirect.js';
import { audit } from '#lib/server/audit.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  await endSession(event);
  if (event.locals.user) audit({ type: 'auth.logout', userId: event.locals.user.id });
  throw localizedRedirect(event.locals.locale, 303, '/login');
};

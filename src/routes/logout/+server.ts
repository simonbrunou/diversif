import { endSession } from '#lib/server/session.js';
import { localizedRedirect } from '#lib/server/redirect.js';
import { audit } from '#lib/server/audit.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const { locals } = event;
  await endSession(event);
  if (locals.user) audit({ type: 'auth.logout', userId: locals.user.id });
  throw localizedRedirect(locals.locale, 303, '/login');
};

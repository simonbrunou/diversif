import { SESSION_COOKIE, invalidateSession } from '$lib/server/auth';
import { localizedRedirect } from '$lib/server/redirect';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, locals, setHeaders }) => {
  // invalidateSession expects the RAW cookie token (it hashes before the DB
  // delete); locals.sessionId holds the stored sha256 digest, which would
  // be double-hashed and never match a row.
  const token = cookies.get(SESSION_COOKIE);
  if (token) {
    await invalidateSession(token);
    if (locals.user) audit({ type: 'auth.logout', userId: locals.user.id });
  }
  cookies.delete(SESSION_COOKIE, { path: '/' });
  // Wipe CacheStorage (the SW 'pages' runtime cache holds authenticated
  // HTML), IndexedDB (offline queue) and the SW registration in one shot so
  // the next person on a shared device can't read the previous user's data.
  // setHeaders applies to the 303 thrown below — SvelteKit merges
  // event-accumulated headers onto the redirect response. Safari doesn't
  // honour Clear-Site-Data reliably, so the logout form also purges
  // client-side before submitting (see purgeBeforeSubmit in
  // $lib/offline/purge).
  setHeaders({ 'Clear-Site-Data': '"cache", "storage"' });
  throw localizedRedirect(locals.locale, 303, '/login');
};

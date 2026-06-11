import { redirect } from '@sveltejs/kit';
import type { Locale } from '$lib/paraglide/runtime';

type RedirectStatus = Parameters<typeof redirect>[0];

/**
 * Throw a redirect that preserves the visitor's locale prefix.
 *
 * Without this, `throw redirect(303, '/login')` from a /en/* request would
 * bounce the visitor onto FR-default '/login', silently flipping the chrome
 * back on every successful auth/mutation flow. Pass `locals.locale` (set by
 * hooks.server.ts) so the helper prefixes the path with /en when needed.
 *
 * Pass paths as unprefixed app paths (e.g. '/', '/login', '/account/deleted').
 * Already /en-prefixed paths and absolute URLs are passed through unchanged.
 */
export function localizedRedirect(locale: Locale, status: RedirectStatus, path: string): never {
  // Treat /en, /en/..., /en?..., /en#... all as already-prefixed so they
  // never get double-stitched into /en/en?... when a caller hand-builds an
  // already-prefixed path.
  if (locale === 'en' && path.startsWith('/') && !/^\/en(?:[/?#]|$)/.test(path)) {
    throw redirect(status, path === '/' ? '/en' : '/en' + path);
  }
  throw redirect(status, path);
}

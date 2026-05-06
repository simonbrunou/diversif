import type { Handle } from '@sveltejs/kit';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  invalidateSession,
  listMembershipsForUser,
  validateSession
} from '$lib/server/auth';

// `script-src` and `style-src` are emitted as a `<meta>` tag by SvelteKit
// (see svelte.config.js `kit.csp`), which lets it hash its own inline
// hydration scripts. The other directives are header-only and complement that
// meta tag. `X-Frame-Options: DENY` (below) covers `frame-ancestors`.
const PERMISSIONS_POLICY =
  'geolocation=(), camera=(), microphone=(), usb=(), payment=(), interest-cohort=()';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get(SESSION_COOKIE) ?? '';
  const validated = token ? validateSession(token) : null;

  if (validated) {
    event.locals.user = validated.user;
    event.locals.sessionId = validated.session.id;
    event.locals.memberships = listMembershipsForUser(validated.user.id);

    if (validated.renewed) {
      event.cookies.set(SESSION_COOKIE, validated.session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: Math.floor(SESSION_DURATION_MS / 1000)
      });
    }
  } else {
    if (token) {
      // Stale token: clear it.
      invalidateSession(token);
      event.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
    event.locals.user = null;
    event.locals.sessionId = null;
    event.locals.memberships = [];
  }

  const response = await resolve(event);

  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Belt-and-braces: any response served to an authenticated user is private
  // by definition, so block crawlers even if a downstream page forgets the
  // <meta name="robots"> tag. Also noindex the account area for anonymous
  // requests (login + deletion confirmation already opt in via Seo, but a
  // missing import shouldn't leak). The blanket header is the cheapest place
  // to enforce the invariant.
  if (event.locals.user || event.url.pathname.startsWith('/account')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
};

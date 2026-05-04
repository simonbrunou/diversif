import type { Handle } from '@sveltejs/kit';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  invalidateSession,
  listMembershipsForUser,
  validateSession
} from '$lib/server/auth';

// Tailwind ships static stylesheets but Svelte hydration injects style attributes,
// so 'unsafe-inline' is required for style-src. Scripts are bundled by Vite so
// inline scripts are not needed.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ');

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

  response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
};

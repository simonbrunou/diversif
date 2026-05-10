// Coolify injects COOLIFY_URL=http://<deploy>.diversif.app at runtime, but
// SvelteKit's CSRF check (and adapter-node's request reconstruction) reads
// process.env.ORIGIN — a static value baked into the prod deploy. Override
// ORIGIN with the per-deploy URL so PR previews self-configure their CSRF
// origin without per-PR Coolify config.
//
// COOLIFY_URL arrives as http:// because Cloudflare terminates TLS in front
// of the container; rewrite the scheme to https so cookies and CSRF stay
// strict-origin-aware.
//
// Runs before the Sentry init below: env mutation has no side-effect on
// Sentry, and we want adapter-node and any boot-time consumers to see the
// corrected ORIGIN immediately.
/* v8 ignore next 3 — module-load Coolify bootstrap; COOLIFY_URL is unset in tests by design */
if (process.env.COOLIFY_URL) {
  process.env.ORIGIN = process.env.COOLIFY_URL.replace(/^http:/, 'https:');
}

// Side-effect-only: must be the first import so Sentry is initialised
// before any module that captures during its own init (e.g. $lib/server/db).
import '$lib/sentry-init.server';

import type { Handle, HandleServerError } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  invalidateSession,
  listMembershipsForUser,
  validateSession
} from '$lib/server/auth';
import * as Sentry from '@sentry/sveltekit';
import { scrubPathname } from '$lib/sentry';
import { setLanguageTag, type AvailableLanguageTag } from '$lib/paraglide/runtime';

/**
 * Tag every server-side error with a short id, log a structured stderr line,
 * and pass only the id back to the client. Operators read the prefixed log
 * line (Coolify streams stderr) and correlate to user reports via the id
 * shown on /+error.svelte.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
  const errorId = randomBytes(4).toString('hex');
  const err = error as Error;
  // The Sentry event already drops user.id and scrubs the URL — this stderr
  // line is the operator-side trail. Apply the same path scrub so child/food
  // IDs and other dynamic segments don't end up in the deployment platform's
  // log aggregator. The event.route?.id pattern (e.g. /child/[id]/log) is a
  // strict superset of the path's debugging value, so prefer it when set.
  console.error(
    '[diversif:error]',
    JSON.stringify({
      id: errorId,
      method: event.request.method,
      path: scrubPathname(event.url.pathname, event.route?.id ?? null),
      userId: event.locals.user?.id ?? null,
      status,
      message,
      name: err?.name,
      msg: err?.message,
      stack: err?.stack
    })
  );
  Sentry.captureException(err, {
    tags: {
      errorId,
      status,
      method: event.request.method,
      route: event.route?.id ?? null
    }
  });
  return { message: 'Internal Error', errorId };
};

// `script-src` and `style-src` are emitted as a `<meta>` tag by SvelteKit
// (see svelte.config.js `kit.csp`), which lets it hash its own inline
// hydration scripts. The other directives are header-only and complement that
// meta tag. `X-Frame-Options: DENY` (below) covers `frame-ancestors`.
const PERMISSIONS_POLICY =
  'geolocation=(), camera=(), microphone=(), usb=(), payment=(), interest-cohort=()';

/**
 * Resolve the request's locale from the ORIGINAL URL — `event.request.url` is
 * the path the browser actually requested, before SvelteKit's `reroute` (in
 * src/hooks.ts) strips the `/en/` prefix. Using `event.url` here would always
 * see the rerouted path and wrongly default to FR.
 */
function resolveLocaleFromRequest(event: Parameters<Handle>[0]['event']): AvailableLanguageTag {
  const path = new URL(event.request.url).pathname;
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'fr';
}

export const handle: Handle = async ({ event, resolve }) => {
  // Set paraglide's runtime tag for SSR (m.X() calls during render + the
  // %paraglide.lang% placeholder substitution below).
  const locale = resolveLocaleFromRequest(event);
  setLanguageTag(locale);
  event.locals.locale = locale;

  const token = event.cookies.get(SESSION_COOKIE) ?? '';
  const validated = token ? await validateSession(token) : null;

  if (validated) {
    event.locals.user = validated.user;
    event.locals.sessionId = validated.session.id;
    event.locals.memberships = await listMembershipsForUser(validated.user.id);

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
      await invalidateSession(token);
      event.cookies.delete(SESSION_COOKIE, { path: '/' });
    }
    event.locals.user = null;
    event.locals.sessionId = null;
    event.locals.memberships = [];
  }

  // Replace %paraglide.lang% in app.html with the resolved locale. Doing this
  // here (rather than via paraglide-sveltekit's i18n.handle()) avoids a bug
  // where the upstream handle reads event.url AFTER reroute has stripped the
  // /en prefix and so always sees 'fr'. Run on every chunk: the placeholder
  // sits in the opening <html> tag, which can land in any chunk when SvelteKit
  // streams a response — gating on `done` would leak `%paraglide.lang%` to the
  // client whenever the head is flushed before the closing chunk.
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
  });

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

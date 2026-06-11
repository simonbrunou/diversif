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
 *
 * 4xx are routing dead-ends — SvelteKit's "no matching route" error
 * (typos, stale bookmarks, bots scanning for /wp-admin), client typos,
 * deliberate aborts — and they would otherwise flood Sentry + stderr with
 * uninteresting noise. The errorId is still generated and returned so
 * /+error.svelte can surface it for support tickets, but no event is
 * captured. Only 5xx (unhandled exceptions in route code, infra failures)
 * are worth waking someone up.
 */
export const handleError: HandleServerError = ({ error, event, status, message }) => {
  const errorId = randomBytes(4).toString('hex');
  if (status < 500) {
    return { message: 'Internal Error', errorId };
  }
  const err = error as Error;
  // The Sentry event already drops user.id and scrubs the URL : this stderr
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

/**
 * Boot-time misconfiguration check. PROTOCOL_HEADER set without
 * ADDRESS_HEADER almost always means "behind a reverse proxy, but
 * getClientAddress() still returns the proxy's socket IP" — every per-IP
 * rate-limit bucket (login, signup, passkeys) then collapses onto one key
 * and a single abuser can lock out every legitimate user. We only warn
 * (never default the header in code or in the image): adapter-node throws
 * on requests lacking the configured header, and a client-supplied
 * x-forwarded-for is spoofable without a trusted proxy stripping it.
 * See DEPLOY.md « Pre-launch environment gate ».
 */
export function warnIfAddressHeaderMissing(
  env: Record<string, string | undefined> = process.env
): boolean {
  if (env.PROTOCOL_HEADER && !env.ADDRESS_HEADER) {
    console.warn(
      '[diversif:boot] PROTOCOL_HEADER is set but ADDRESS_HEADER is not. The app looks like it sits behind a reverse proxy, so every per-IP rate limit currently keys on the proxy address — one abusive client can lock everyone out. Set ADDRESS_HEADER (cf-connecting-ip behind a Cloudflare Tunnel; x-forwarded-for plus XFF_DEPTH behind a directly-exposed proxy). See DEPLOY.md.'
    );
    return true;
  }
  return false;
}
warnIfAddressHeaderMissing();

// `script-src` and `style-src` are emitted as a `<meta>` tag by SvelteKit
// (see svelte.config.js `kit.csp`), which lets it hash its own inline
// hydration scripts. The other directives are header-only and complement that
// meta tag. `X-Frame-Options: DENY` (below) covers `frame-ancestors`.
const PERMISSIONS_POLICY =
  'geolocation=(), camera=(), microphone=(), usb=(), payment=(), interest-cohort=()';

/**
 * Resolve the request's locale from the ORIGINAL URL : `event.request.url` is
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
  //
  // KNOWN LIMITATION (deliberate): setLanguageTag mutates a module-level
  // global, and the awaits below (session queries) yield the event loop, so
  // two concurrent requests with different locales can cross-contaminate each
  // other's SSR output (audit item 9). The AsyncLocalStorage-based fix —
  // paraglide-sveltekit's i18n.handle() — can't be adopted here: it reads
  // event.url AFTER src/hooks.ts reroute() has stripped the /en prefix and so
  // always resolves 'fr' (same upstream bug that forced the manual
  // %paraglide.lang% substitution below). Revisit when migrating to
  // paraglide-js 2.x, whose runtime is AsyncLocalStorage-aware out of the
  // box.
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
      // Re-set the RAW token from the cookie (not validated.session.id, which
      // is its sha256 digest) — renewal only extends maxAge, never rotates.
      event.cookies.set(SESSION_COOKIE, token, {
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
  // streams a response : gating on `done` would leak `%paraglide.lang%` to the
  // client whenever the head is flushed before the closing chunk.
  //
  // The theme cookie (written by $lib/utils/theme alongside localStorage)
  // lets SSR emit class="dark" on <html> for explicit-dark users, so the
  // first paint is correct without waiting for the inline theme-init script.
  // 'system' can't be resolved server-side (no prefers-color-scheme on the
  // request), so that case stays with the inline script.
  const darkTheme = event.cookies.get('theme') === 'dark';
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      let out = html.replace('%paraglide.lang%', locale);
      if (darkTheme) out = out.replace('<html ', '<html class="dark" ');
      return out;
    }
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

import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { listMembershipsForUser } from '#lib/server/auth.js';
import { resumeSession } from '#lib/server/session.js';
import * as Sentry from '@sentry/sveltekit';
import { handleServerError, tagHandleChainError } from '#lib/sentry-policy.js';
import type { Locale } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { withFallbackTitle } from '#lib/server/document-title.js';

/**
 * Every server-side error gets a short id, shown on /+error.svelte; a reported
 * one also gets a structured `[diversif:error]` stderr line (Coolify streams
 * stderr) and a Sentry event. See #lib/sentry-policy.ts.
 */
export const handleError = handleServerError;

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

// `script-src` and `style-src` are emitted as a `<meta>` tag by SvelteKit (see
// the `csp` option of sveltekit() in vite.config.ts), which lets it hash its
// own inline hydration scripts. The other directives are header-only and
// complement that meta tag. `X-Frame-Options: DENY` (below) covers
// `frame-ancestors`.
const PERMISSIONS_POLICY =
  'geolocation=(), camera=(), microphone=(), usb=(), payment=(), interest-cohort=()';

/**
 * The app's request handling, run inside `paraglideMiddleware`'s
 * AsyncLocalStorage scope so every `m.X()` call during SSR resolves the
 * request's own locale. This closes the old 1.x cross-contamination race
 * (audit item 9): `setLanguageTag` mutated a module-level global, and the
 * session awaits below yield the event loop, so two concurrent requests
 * with different locales could cross-contaminate each other's SSR output.
 * With paraglide 2.x the locale lives in per-request async context instead.
 */
const appHandle = async (
  event: Parameters<Handle>[0]['event'],
  resolve: Parameters<Handle>[0]['resolve'],
  locale: Locale
): Promise<Response> => {
  event.locals.locale = locale;

  const user = await resumeSession(event);
  event.locals.user = user;
  event.locals.memberships = user ? await listMembershipsForUser(user.id) : [];

  // Replace %paraglide.lang% in app.html with the resolved locale. Run on
  // every chunk: the placeholder sits in the opening <html> tag, which can
  // land in any chunk when SvelteKit streams a response : gating on `done`
  // would leak `%paraglide.lang%` to the client whenever the head is flushed
  // before the closing chunk.
  //
  // The theme cookie (written by #lib/utils/theme alongside localStorage)
  // lets SSR emit class="dark" on <html> for explicit-dark users, so the
  // first paint is correct without waiting for the inline theme-init script.
  // 'system' can't be resolved server-side (no prefers-color-scheme on the
  // request), so that case stays with the inline script.
  //
  // A page that names itself renders its own <title>; any other gets the
  // app-wide one here (see #lib/server/document-title.ts).
  const darkTheme = event.cookies.get('theme') === 'dark';
  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      let out = withFallbackTitle(html.replace('%paraglide.lang%', locale));
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

  // Belt-and-braces (2): the service worker's own runtime-caching config
  // (src/service-worker/index.ts) is the primary defense against a shared/offline device
  // replaying a previous user's authenticated HTML — it never writes /child,
  // /account or /join responses to CacheStorage in the first place. This
  // header is the secondary layer for surfaces Workbox doesn't cover: the
  // browser's plain HTTP cache and back/forward cache. Every response for a
  // signed-in request can embed session data (e.g. the root layout's child
  // list), so the check isn't limited to specific route prefixes.
  if (event.locals.user) {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
};

/**
 * Wrap the app's handle in paraglide's server middleware. The middleware
 * resolves the locale from the ORIGINAL request URL (`event.request.url` is
 * the path the browser actually requested, before SvelteKit's `reroute` in
 * src/hooks.ts strips the `/en` prefix — `event.url` would always look FR),
 * then runs the callback inside an AsyncLocalStorage scope so concurrent
 * requests with different locales can no longer cross-contaminate SSR
 * output. With the url-only strategy (see vite.config.ts) the resolved
 * locale always matches the URL, so the middleware never issues a locale
 * redirect — routing behavior is byte-identical to the 1.x setup.
 */
export const localizedHandle: Handle = async ({ event, resolve }) => {
  try {
    return await paraglideMiddleware(event.request, ({ request, locale }) => {
      // The middleware hands back a request whose URL is de-localized,
      // matching what `reroute` already did for `event.url`. The clone took
      // over the original's body, so loads and actions must read the clone.
      // RequestEvent is typed readonly since SvelteKit 3, but the event is a
      // plain object and handle may still swap the request.
      Object.assign(event, { request });
      return appHandle(event, resolve, locale);
    });
  } catch (err) {
    tagHandleChainError(err, event);
    throw err;
  }
};

/**
 * sentryHandle runs first: it gives every request its own isolation scope,
 * names the server transaction after the route pattern, continues the
 * browser's trace and adds the `sentry-trace`/`baggage` meta tags that link
 * the pageload span to it. The fetch-proxy script it can inject is only needed
 * for SvelteKit < 2.16 and would be blocked by the hash-based CSP anyway.
 */
export const handle: Handle = sequence(
  Sentry.sentryHandle({ injectFetchProxyScript: false }),
  localizedHandle
);

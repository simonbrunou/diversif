import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';
import {
  SENTRY_TUNNEL_PATH,
  filterIncomingBreadcrumb,
  parseSampleRate,
  scrubEvent,
  scrubSpan
} from '$lib/sentry';

// No paraglide bootstrap is needed here since the 2.x migration: the
// runtime's `url` strategy re-reads window.location on every getLocale()
// call, so the locale is correct before hydration and across client-side
// navigations (the layout still syncs <html lang>).

Sentry.init({
  dsn: env.PUBLIC_SENTRY_DSN || '',
  environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
  // Inlined at build time by Vite's `define` (vite.config.ts), so the
  // server-side SHA and the client bundle share one constant.
  release: __SENTRY_RELEASE__,
  // Envelopes go to our own origin, which relays them to Sentry
  // (src/routes/monitoring/+server.ts): Sentry never sees a parent's IP
  // address, and CSP connect-src stays 'self'.
  tunnel: SENTRY_TUNNEL_PATH,
  // The SDK posts binary envelopes (compressed replay segments) without a
  // Content-Type, and SvelteKit hands a body-less Request to any endpoint
  // whose request lacks one — the tunnel would receive nothing. Declaring the
  // envelope type also keeps these same-origin posts out of SvelteKit's
  // form-submission CSRF check, which only concerns form content types.
  transportOptions: { headers: { 'Content-Type': 'application/x-sentry-envelope' } },
  // Browser tracing (pageload/navigation spans named after the route
  // pattern, Web Vitals, same-origin fetches) comes from the SvelteKit SDK's
  // browserTracingIntegration below; sentryHandle's <meta> tags join it to
  // the server trace.
  tracesSampleRate: parseSampleRate(env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.1),
  // Session Replay defaults to error-only: the last minute before a captured
  // error is kept in memory and sent with it; no session is recorded
  // otherwise unless an operator raises the session rate. The recorder itself
  // is added below, once its chunk has loaded.
  replaysSessionSampleRate: parseSampleRate(env.PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
  replaysOnErrorSampleRate: parseSampleRate(env.PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1),
  // Explicitly opt out of default PII (IP address, cookies, user agent).
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration({
      // One span per hashed /_app/immutable/*.js chunk made a full pageload
      // ~150 KB (95 script spans) — past BODY_SIZE_LIMIT, so the tunnel
      // rejected it — and the timing of immutable, service-worker-cached
      // chunks says little. CSS, fonts, images and fetches keep their spans.
      ignoreResourceSpans: ['resource.script']
    }),
    {
      // beforeSend never sees replay or feedback events; scrub them here.
      name: 'DiversifPrivacy',
      processEvent: (event) =>
        event.type === 'replay_event' || event.type === 'feedback' ? scrubEvent(event) : event
    }
  ],
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeSendSpan: scrubSpan,
  beforeBreadcrumb: filterIncomingBreadcrumb
});

// Code-split: the replay recorder is ~100 KB and not needed for the first
// paint, so it loads right after startup — and not at all when browser capture
// is disabled.
if (env.PUBLIC_SENTRY_DSN) {
  void import('$lib/sentry-replay').then(({ startReplay }) => startReplay());
}

// Tags omit `method` (which the server hook records): SvelteKit's
// `NavigationEvent` has no `request` property in the browser, and there is no
// reliable equivalent (clicks, popstate, programmatic navigations all reach
// here without a method).
//
// 4xx are skipped to match the server-side gate: client-side 404s (e.g. a
// data-load throwing notFound) are routing dead-ends, not bugs. Only 5xx
// reach Sentry, tagged with an errorId the error page shows (and the
// « Signaler ce problème » report carries) so a parent's report and the
// Sentry issue can be matched.
export const handleError: HandleClientError = ({ error, event, status }) => {
  if (status < 500) {
    return { message: 'Internal Error' };
  }
  const errorId = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0');
  Sentry.captureException(error, {
    mechanism: { type: 'auto.function.sveltekit.handle_error', handled: false },
    captureContext: {
      tags: {
        errorId,
        status,
        route: event.route?.id ?? null
      }
    }
  });
  return { message: 'Internal Error', errorId };
};

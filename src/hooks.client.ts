import * as Sentry from '@sentry/sveltekit';
import {
  PUBLIC_SENTRY_DSN,
  PUBLIC_SENTRY_ENVIRONMENT,
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
} from '$app/env/public';
import { clientSentryOptions, handleClientError } from '#lib/sentry-policy.js';
import { loadReplay } from '#lib/sentry-replay-loader.js';
import { recoverFromFailedBoot } from '#lib/boot-recovery.js';

// No paraglide bootstrap is needed here since the 2.x migration: the
// runtime's `url` strategy re-reads window.location on every getLocale()
// call, so the locale is correct before hydration and across client-side
// navigations (the layout still syncs <html lang>).

// What is reported, dropped and scrubbed is #lib/sentry-policy.ts's call.
Sentry.init(
  clientSentryOptions(
    {
      PUBLIC_SENTRY_DSN,
      PUBLIC_SENTRY_ENVIRONMENT,
      PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
      PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE
    },
    [
      // Browser tracing: pageload/navigation spans named after the route
      // pattern, Web Vitals, same-origin fetches; sentryHandle's <meta> tags
      // join it to the server trace.
      Sentry.browserTracingIntegration()
    ]
  )
);

// Replay is code-split and starts right after init (see loadReplay) — not at
// all when browser capture is disabled.
if (PUBLIC_SENTRY_DSN) void loadReplay();

// This module runs before kit.start(), so the listener is in place when the
// root chunks load; a network failure before hydration means the app could
// not start (see boot-recovery.ts).
window.addEventListener('unhandledrejection', (event) => recoverFromFailedBoot(event.reason));

export const handleError = handleClientError;

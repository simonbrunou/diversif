import * as Sentry from '@sentry/sveltekit';
import {
  SENTRY_TUNNEL_PATH,
  filterIncomingBreadcrumb,
  parseSampleRate,
  scrubEvent,
  scrubLog,
  scrubSpan
} from '$lib/sentry';

// SvelteKit loads this file before any other server module (see
// `kit.experimental.instrumentation.server` in svelte.config.js), so the SDK is
// configured before $lib/server/db runs its migrations and before the
// OpenTelemetry tracer that `kit.experimental.tracing.server` reports to is
// first used.
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  // Inlined at build time by Vite's `define` — see vite.config.ts. The
  // resolver there walks SENTRY_RELEASE → SOURCE_COMMIT → GITHUB_SHA →
  // GIT_COMMIT_SHA → `git rev-parse HEAD`, then emits either a string
  // literal or the bare `undefined` token.
  release: __SENTRY_RELEASE__,
  tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  // Structured operational logs (boot, migrations, cleanup, shutdown) sent
  // explicitly via Sentry.logger. Console output is deliberately NOT captured:
  // handleError's `[diversif:error]` line carries the user id and raw path.
  enableLogs: true,
  // Explicitly opt out of default PII (IP address, cookies, user agent).
  // This is v10's default, but a future SDK upgrade flipping it must not
  // silently leak identifiers into every event.
  sendDefaultPii: false,
  // Every browser envelope relayed by the tunnel would otherwise produce its
  // own server transaction; `sveltekit.handle.root` is the root span of a
  // request matching no route (bot scans, 404s), which sentryHandle never
  // renames.
  ignoreTransactions: [`POST ${SENTRY_TUNNEL_PATH}`, 'sveltekit.handle.root'],
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeSendSpan: scrubSpan,
  beforeSendLog: scrubLog,
  beforeBreadcrumb: filterIncomingBreadcrumb
});

Sentry.logger.info('Server starting', { runtime: `bun ${Bun.version}` });

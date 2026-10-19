import * as Sentry from '@sentry/sveltekit';
import { serverSentryOptions } from '#lib/sentry-policy.js';

// SvelteKit loads this file before any other server module (it picks up
// src/instrumentation.server.ts automatically), so the SDK is configured
// before #lib/server/db runs its migrations and before the OpenTelemetry
// tracer that SvelteKit's `tracing.server` option (vite.config.ts) reports to
// is first used. What is reported, dropped and scrubbed is
// #lib/sentry-policy.ts's call.
Sentry.init(
  serverSentryOptions({
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE
  })
);

Sentry.logger.info('Server starting', { runtime: `bun ${Bun.version}` });

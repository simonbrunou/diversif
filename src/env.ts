import { defineEnvVars } from '@sveltejs/kit/env';

// Browser-side Sentry configuration, read at runtime (SvelteKit's default for
// env vars) so one Docker image serves every deployment. Unset values become
// '' — hooks.client.ts treats an empty DSN as "browser capture disabled" and
// falls back to its own defaults for the rest. The server reads its SENTRY_*
// counterparts straight from process.env (src/instrumentation.server.ts).
const optional = (input: string | undefined) => input ?? '';

export const variables = defineEnvVars({
  PUBLIC_SENTRY_DSN: { public: true, schema: optional },
  PUBLIC_SENTRY_ENVIRONMENT: { public: true, schema: optional },
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE: { public: true, schema: optional },
  PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: { public: true, schema: optional },
  PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: { public: true, schema: optional }
});

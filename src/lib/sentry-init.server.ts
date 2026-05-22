import * as Sentry from '@sentry/sveltekit';
import { scrubEvent, filterIncomingBreadcrumb } from '$lib/sentry';

// Side-effect-only module: `import '$lib/sentry-init.server'` initialises
// Sentry once, at the top of any server module that needs it. Importing
// this module at the top of $lib/server/db/index.ts (which runs Sentry-
// capturing code during module init) guarantees the SDK is configured
// BEFORE captureException is called from db init paths.
//
// @sentry/sveltekit's Sentry.init is idempotent; a second call from
// hooks.server.ts is a no-op.
Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  // docker-entrypoint.sh resolves SENTRY_RELEASE from /app/.release-sha or
  // a CI env var (SOURCE_COMMIT / GITHUB_SHA / GIT_COMMIT_SHA) before
  // exec'ing node, so a single env-var read here covers every deploy path.
  // Keeping the fallback chain in shell (instead of inlining || branches
  // here) also avoids untestable env-var-truthy branches under vitest's
  // 100% coverage threshold.
  release: process.env.SENTRY_RELEASE || undefined,
  tracesSampleRate: 0,
  // Explicitly opt out of default PII (IP address, cookies, user agent).
  // This is v8's default but we set it explicitly so a future SDK upgrade
  // that flips the default doesn't silently leak the prod server's IP into
  // every event's user.ip_address.
  sendDefaultPii: false,
  // @ts-expect-error - Sentry's `Breadcrumb` type has no string-index
  // signature, so its `ErrorEvent.breadcrumbs` is not structurally assignable
  // to our isomorphic `ScrubbableEvent.breadcrumbs` (we keep the
  // `[key: string]: unknown` on our type so we can clone breadcrumb data
  // with `{ ...b, data }`). Drop this suppression if either type tightens
  // : it'll fail loudly via @ts-expect-error.
  beforeSend: scrubEvent,
  beforeBreadcrumb: filterIncomingBreadcrumb
});

import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';
import { scrubEvent, filterUiBreadcrumb } from '$lib/sentry';

Sentry.init({
  dsn: env.PUBLIC_SENTRY_DSN || '',
  environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
  tracesSampleRate: 0,
  // @ts-expect-error - Sentry's `Breadcrumb` type has no string-index signature,
  // so its `ErrorEvent.breadcrumbs` is not structurally assignable to our
  // isomorphic `ScrubbableEvent.breadcrumbs` (we keep the `[key: string]: unknown`
  // on our type so we can clone breadcrumb data with `{ ...b, data }`). Drop this
  // suppression if either type tightens — it'll fail loudly via @ts-expect-error.
  beforeSend: scrubEvent,
  beforeBreadcrumb: filterUiBreadcrumb
});

export const handleError: HandleClientError = ({ error, event, status, message: _message }) => {
  Sentry.captureException(error, {
    tags: {
      status,
      route: event.route?.id ?? null
    }
  });
  return { message: 'Internal Error' };
};

/**
 * PII scrubbing applied to every Sentry event before it leaves the process.
 * Imported by hooks.server.ts and hooks.client.ts as the `beforeSend` callback.
 *
 * Posture: strict, defence in depth. The errorId in event.tags is the only
 * correlation token. From the SDK side this scrubber drops user.id, email,
 * request body, cookies, headers, query string, message bodies, and stack
 * frame locals; combined with `sendDefaultPii: false` in Sentry.init, no
 * client identifiers leave the process.
 *
 * Geo enrichment is enforced Sentry-side: when an event arrives over the
 * network, Sentry's ingest derives user.geo from the *connection IP* (the
 * process posting the event) unless the project's "Prevent Storing of IP
 * Addresses" setting is enabled. Toggle that in Settings → Security & Privacy
 * for the project — this file cannot influence ingest-side enrichment.
 */

type ScrubbableEvent = {
  tags?: Record<string, unknown>;
  request?: {
    url?: string;
    data?: unknown;
    query_string?: unknown;
    cookies?: unknown;
    headers?: unknown;
  };
  user?: unknown;
  message?: unknown;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: { frames?: Array<{ vars?: unknown; [key: string]: unknown }> };
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  breadcrumbs?: Array<{
    category?: string;
    data?: unknown;
    [key: string]: unknown;
  }>;
  transaction?: string;
};

const NUMERIC = /^\d+$/;
// A segment is treated as an opaque token when it is 8+ chars long AND
// contains at least one digit or non-alpha character (e.g. UUID fragments,
// hashed IDs). Pure-alpha words like "passkeys" are kept verbatim.
const LONG_TOKEN = /^(?=.*[\d_-])[A-Za-z0-9_-]{8,}$/;

export function scrubPathname(pathname: string, routeId: string | null = null): string {
  if (routeId) return routeId;
  if (!pathname || pathname === '/') return '/';
  const segments = pathname.split('/').filter(Boolean);
  const scrubbed = segments.map((seg) =>
    NUMERIC.test(seg) || LONG_TOKEN.test(seg) ? '[id]' : seg
  );
  return '/' + scrubbed.join('/');
}

function scrubUrlString(raw: string, routeId: string | null = null): string {
  try {
    if (raw.startsWith('/')) {
      // Relative URL : just rewrite the pathname.
      const [path] = raw.split('?', 1);
      return scrubPathname(path, routeId);
    }
    const u = new URL(raw);
    u.search = '';
    u.pathname = scrubPathname(u.pathname, routeId);
    return u.toString();
  } catch {
    return scrubPathname(raw, routeId);
  }
}

/**
 * Drop breadcrumbs that the SDK auto-collects but we don't want sent to
 * Sentry under the strict-PII contract:
 *
 * - `ui.click` / `ui.input` : DOM events may capture user input via target
 *   attributes (e.g. value="user@example.com" on a form input).
 * - `console` : our handleError emits a structured JSON `[diversif:error]`
 *   log line via console.error before Sentry.captureException; the SDK would
 *   attach that JSON (containing userId, raw path, msg, stack) as a
 *   breadcrumb on subsequent events, bypassing the rest of scrubEvent.
 *
 * Wired as `beforeBreadcrumb` in both hooks so dropped breadcrumbs never
 * enter the SDK's internal buffer; the same filter is also applied inside
 * scrubEvent as a belt-and-braces second pass.
 */
export function filterIncomingBreadcrumb<B extends { category?: string }>(b: B): B | null {
  if (b.category === 'ui.click' || b.category === 'ui.input') return null;
  if (b.category === 'console') return null;
  return b;
}

// Strip free-form text that may contain user input. The errorId tag is
// still attached, and the full Error message + stack live in the
// [diversif:error] stderr line indexed by that token.
const REDACTED = '[redacted: see errorId in stderr]';

/** Compute the route pattern used to scrub request/breadcrumb URLs. */
function eventRoute(event: ScrubbableEvent): string | null {
  if (typeof event.tags?.route === 'string') return event.tags.route as string;
  return event.transaction ?? null;
}

/**
 * Rewrite the request URL through the route pattern and drop every field that
 * can carry PII: body data, cookies, headers, and the raw query string.
 */
function scrubRequest(
  request: NonNullable<ScrubbableEvent['request']>,
  route: string | null
): void {
  if (typeof request.url === 'string') {
    request.url = scrubUrlString(request.url, route);
  }
  delete request.data;
  delete request.cookies;
  delete request.headers;
  delete request.query_string;
}

/**
 * Redact exception messages (which may quote user input) and drop stack frame
 * locals (`vars`), which can capture in-scope PII.
 */
function scrubException(exception: NonNullable<ScrubbableEvent['exception']>): void {
  if (!Array.isArray(exception.values)) return;
  for (const ex of exception.values) {
    if (typeof ex.value === 'string') ex.value = REDACTED;
    const frames = ex.stacktrace?.frames;
    if (Array.isArray(frames)) {
      for (const frame of frames) {
        delete frame.vars;
      }
    }
  }
}

/** Scrub the URL-bearing keys of a single breadcrumb's data object. */
function scrubBreadcrumbData(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...data };
  for (const key of ['url', 'from', 'to']) {
    if (typeof scrubbed[key] === 'string') {
      scrubbed[key] = scrubUrlString(scrubbed[key] as string);
    }
  }
  return scrubbed;
}

/**
 * Drop the SDK-collected breadcrumbs we never want sent (see
 * filterIncomingBreadcrumb) and scrub URLs in the survivors' data.
 */
function scrubBreadcrumbs(
  breadcrumbs: NonNullable<ScrubbableEvent['breadcrumbs']>
): NonNullable<ScrubbableEvent['breadcrumbs']> {
  return breadcrumbs
    .filter(
      (b) => b.category !== 'ui.click' && b.category !== 'ui.input' && b.category !== 'console'
    )
    .map((b) =>
      b.data && typeof b.data === 'object'
        ? { ...b, data: scrubBreadcrumbData(b.data as Record<string, unknown>) }
        : b
    );
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E | null {
  try {
    if (!event || typeof event !== 'object') return null;

    const route = eventRoute(event);

    if (event.request) scrubRequest(event.request, route);

    delete event.user;

    if (typeof event.message === 'string') event.message = REDACTED;
    if (event.exception) scrubException(event.exception);

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = scrubBreadcrumbs(event.breadcrumbs);
    }

    return event;
  } catch {
    return null;
  }
}

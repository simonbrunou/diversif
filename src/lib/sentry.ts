/**
 * PII scrubbing applied to every Sentry event before it leaves the process.
 * Imported by hooks.server.ts and hooks.client.ts as the `beforeSend` callback.
 *
 * Posture: strict. The errorId in event.tags is the only correlation token;
 * Sentry never sees user.id, email, IP, request body, cookies, or headers.
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

export function scrubEvent<E extends ScrubbableEvent>(event: E): E | null {
  try {
    if (!event || typeof event !== 'object') return null;

    const route =
      typeof event.tags?.route === 'string'
        ? (event.tags.route as string)
        : (event.transaction ?? null);

    if (event.request) {
      if (typeof event.request.url === 'string') {
        event.request.url = scrubUrlString(event.request.url, route);
      }
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.query_string;
    }

    delete event.user;

    // Strip free-form text that may contain user input. The errorId tag is
    // still attached, and the full Error message + stack live in the
    // [diversif:error] stderr line indexed by that token.
    const REDACTED = '[redacted: see errorId in stderr]';
    if (typeof event.message === 'string') {
      event.message = REDACTED;
    }
    if (event.exception && Array.isArray(event.exception.values)) {
      for (const ex of event.exception.values) {
        if (typeof ex.value === 'string') ex.value = REDACTED;
        const frames = ex.stacktrace?.frames;
        if (Array.isArray(frames)) {
          for (const frame of frames) {
            delete frame.vars;
          }
        }
      }
    }

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs
        .filter(
          (b) => b.category !== 'ui.click' && b.category !== 'ui.input' && b.category !== 'console'
        )
        .map((b) => {
          if (b.data && typeof b.data === 'object') {
            const data = { ...(b.data as Record<string, unknown>) };
            for (const key of ['url', 'from', 'to']) {
              if (typeof data[key] === 'string') {
                data[key] = scrubUrlString(data[key] as string);
              }
            }
            return { ...b, data };
          }
          return b;
        });
    }

    return event;
  } catch {
    return null;
  }
}

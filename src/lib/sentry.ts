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
      // Relative URL — just rewrite the pathname.
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
 * Drop UI breadcrumbs (clicks, focus) at capture time as a belt-and-braces
 * complement to the same filter inside scrubEvent. SDK-shape signature so it
 * can be passed directly to Sentry.init({ beforeBreadcrumb }).
 */
export function filterUiBreadcrumb<B extends { category?: string }>(b: B): B | null {
  return b.category === 'ui.click' || b.category === 'ui.input' ? null : b;
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

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs
        .filter((b) => b.category !== 'ui.click' && b.category !== 'ui.input')
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

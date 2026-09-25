/**
 * PII scrubbing applied to every Sentry payload before it leaves the process:
 * errors (`beforeSend`), transactions (`beforeSendTransaction`), spans
 * (`beforeSendSpan`), logs (`beforeSendLog`), replay/feedback events (the
 * client's privacy integration) and replay recording frames
 * (`beforeAddRecordingEvent`). Imported by src/instrumentation.server.ts and
 * src/hooks.client.ts so both runtimes share one rule set.
 *
 * Posture: strict, defence in depth. The errorId in event.tags is the only
 * correlation token. From the SDK side this scrubber drops user.id, email,
 * request body, cookies, headers, query string, message bodies, stack frame
 * locals, and every span/log attribute that can carry a client identifier
 * (request headers, client address, user agent); combined with
 * `sendDefaultPii: false` in Sentry.init, no client identifiers leave the
 * process.
 *
 * Browser payloads reach Sentry through the same-origin tunnel
 * (src/routes/monitoring/+server.ts), so Sentry's ingest only ever sees the
 * server's IP address — never a parent's — and cannot derive user.geo from it.
 * Keep the project's "Prevent Storing of IP Addresses" setting enabled as a
 * second layer (Settings → Security & Privacy).
 */

import type { Breadcrumb, Event } from '@sentry/sveltekit';

/** Same-origin path the browser SDK posts envelopes to (see hooks.client.ts). */
export const SENTRY_TUNNEL_PATH = '/monitoring';

type ScrubbableSpan = {
  description?: string;
  op?: string;
  data?: Record<string, unknown>;
};

type ScrubbableLog = {
  attributes?: Record<string, unknown>;
};

/** Narrow an unknown payload fragment to a mutable plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
      const [path] = raw.split(/[?#]/, 1);
      return scrubPathname(path, routeId);
    }
    const u = new URL(raw);
    u.search = '';
    u.hash = '';
    u.pathname = scrubPathname(u.pathname, routeId);
    return u.toString();
  } catch {
    return scrubPathname(raw, routeId);
  }
}

const HTTP_METHOD_PREFIX = /^(?:GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS) /;
const URL_LIKE = /^(?:https?:\/\/|\/)/;

/**
 * Scrub a span/transaction name of the shape `[METHOD ]<url-or-path>`, e.g.
 * `GET /child/18/log?/save` → `GET /child/[id]/log`. Any other name
 * (`sveltekit.load`, `domContentLoadedEvent`) is returned unchanged, and route
 * patterns survive verbatim because `[id]`-style segments never match the id
 * heuristics in scrubPathname.
 */
function scrubName(name: string): string {
  const method = HTTP_METHOD_PREFIX.exec(name)?.[0] ?? '';
  const target = name.slice(method.length);
  return URL_LIKE.test(target) ? method + scrubUrlString(target) : name;
}

// Span/log attributes that identify the client. sentryHandle copies inbound
// request headers onto the server span (including cf-connecting-ip and the
// referer), and the HTTP semantic conventions add peer addresses and the user
// agent. None of them is needed to debug the app, so they are dropped outright.
const CLIENT_ATTRIBUTE =
  /^(?:http\.(?:request|response)\.header\.|user\.|client\.|user_agent\.|network\.peer\.|net\.(?:peer|sock)\.)|^http\.(?:client_ip|user_agent)$/;
// Query strings and fragments carry arbitrary client input.
const QUERY_ATTRIBUTE = /(?:^|\.)(?:query|fragment)$/;
// Web-vital attributes naming the DOM element involved (LCP element, CLS
// sources) — CSS-selector strings built by the SDK's htmlTreeAsString.
const SELECTOR_ATTRIBUTE = /(?:^|\.)(?:lcp\.element|cls\.source\.\d+)$/;
// The `[attr="value"]` parts htmlTreeAsString appends (aria-label, title,
// alt, name…). In this app those values name children and foods, e.g.
// `a[aria-label="Ouvrir les réglages de Léo"]`; tag, id and classes stay.
// Values are not escaped (a food named `Purée "maison"` keeps its quotes), so
// a block ends at the `"]` followed by the next block, the ` > ` between
// elements, or the end — attribute blocks always close an element's segment.
const SELECTOR_ATTRIBUTE_VALUE = /\[[\w-]+=".*?"\](?=\[[\w-]+="|\s>\s|$)/g;

function scrubSelector(selector: string): string {
  return selector.replace(SELECTOR_ATTRIBUTE_VALUE, '');
}

/** Drop client-identifying attributes and scrub every URL- or selector-shaped value. */
function scrubAttributes(attributes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attributes)) {
    if (CLIENT_ATTRIBUTE.test(key) || QUERY_ATTRIBUTE.test(key)) {
      delete attributes[key];
    } else if (typeof value === 'string') {
      attributes[key] = SELECTOR_ATTRIBUTE.test(key) ? scrubSelector(value) : scrubName(value);
    }
  }
}

/**
 * `beforeSendSpan`: scrub the span name and its attributes in place. INP, LCP
 * and CLS spans (`ui.interaction.*`, `ui.webvital.*`) are named after the DOM
 * element involved rather than a URL.
 */
export function scrubSpan<S extends ScrubbableSpan>(span: S): S {
  const op = span.op ?? span.data?.['sentry.op'];
  if (typeof span.description === 'string') {
    span.description =
      typeof op === 'string' && op.startsWith('ui.')
        ? scrubSelector(span.description)
        : scrubName(span.description);
  }
  if (span.data && typeof span.data === 'object') scrubAttributes(span.data);
  return span;
}

/**
 * `beforeSendLog`: log bodies are authored by us and never interpolate user
 * data; the attributes the SDK attaches (request context, user, address) get
 * the same treatment as span attributes.
 */
export function scrubLog<L extends ScrubbableLog>(log: L): L {
  if (log.attributes && typeof log.attributes === 'object') scrubAttributes(log.attributes);
  return log;
}

/**
 * Parse a `*_SAMPLE_RATE` env value. Anything that is not a number in [0, 1]
 * (unset, empty, typo, out of range) falls back to the documented default
 * rather than silently sampling everything or nothing.
 */
export function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
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

// What each browser engine says when the network fails the request —
// offline, connection dropped before or while the body streams in, request
// aborted by a page unload — for a `fetch` (SvelteKit's `__data.json`) or a
// code-split chunk import. Sentry's fetch instrumentation may append the
// host: `Failed to fetch (diversif.app)`.
const NETWORK_FAILURE_MESSAGES = [
  // Chromium
  /^Failed to fetch(?: \(.*\))?$/,
  /^network error$/,
  /^Failed to fetch dynamically imported module: /,
  // Firefox
  /^NetworkError when attempting to fetch resource\.(?: \(.*\))?$/,
  /^error loading dynamically imported module: /,
  // dom/streams/UnderlyingSourceCallbackHelpers.cpp: the body stream broke.
  /^Error in input stream$/,
  // WebKit
  /^Load failed(?: \(.*\))?$/,
  /^The Internet connection appears to be offline\.$/,
  /^Importing a module script failed\.$/
];

/**
 * Whether a client-side error is the browser failing to reach the server
 * rather than a bug. Engines raise these as a `TypeError` with no app frames
 * (chunk imports) or only SvelteKit's (fetches), and the scrubbed message is
 * the same for all of them, so they pile into one opaque Sentry issue
 * whatever the route (DIVERSIF-4). A redeploy that removes the previous
 * build's hashed chunks fails the same way for a tab still on the old build.
 */
export function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError && NETWORK_FAILURE_MESSAGES.some((re) => re.test(error.message))
  );
}

/** A path segment as SvelteKit decodes it into `params`; a malformed escape stays raw. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Route tag for a client-side handleError event. SvelteKit hands the hook
 * the route pattern (`/child/[id]/guide`) — except when the `__data.json`
 * fetch itself fails, where `route.id` is the page key: raw pathname plus
 * query (`/child/18/guide?x=1`). scrubEvent trusts the tag as a pattern, so a
 * raw key must be turned back into one here. The query goes whatever the
 * route (`/signup?code=` carries an invite code); a pattern never has one.
 *
 * Each param value is swapped back for its `[name]`, in route order:
 * scrubPathname's heuristics miss a short or alphabetic value such as a
 * mistyped invite code. Optional and rest params that matched nothing carry
 * no value to find. A static route has no params, so its id comes back
 * verbatim, which scrubPathname would get wrong (`/politique-confidentialite`
 * → `/[id]`). If a value is missing, the id is either a real pattern (it
 * contains `[`), kept verbatim, or a value spanning segments (a rest param),
 * left to scrubPathname. A raw key can contain `[` too (`/child/[18]/guide`),
 * hence substituting before that check.
 */
export function clientRouteTag(
  routeId: string | null | undefined,
  params: Record<string, unknown>
): string | null {
  if (!routeId) return null;
  const path = routeId.split(/[?#]/, 1)[0];
  const pending = Object.entries(params).filter(([, value]) => value);
  const segments = path.split('/').map((segment) => {
    const next = pending[0];
    if (!next || decodeSegment(segment) !== next[1]) return segment;
    pending.shift();
    return `[${next[0]}]`;
  });
  if (pending.length === 0) return segments.join('/');
  return path.includes('[') ? path : scrubPathname(path);
}

// Strip free-form text that may contain user input. The errorId tag is
// still attached, and the full Error message + stack live in the
// [diversif:error] stderr line indexed by that token.
const REDACTED = '[redacted: see errorId in stderr]';

/**
 * Compute the route pattern used to scrub request/breadcrumb URLs: the route
 * tag set by our handleError hooks, else the transaction name when it is
 * already a pattern (`GET /child/[id]/log` from sentryHandle, `/child/[id]` from
 * browser tracing). A raw pathname such as `/child/18/guide` is not a pattern
 * and must not be trusted as one, or it would be copied verbatim into the URL.
 */
function eventRoute(event: Event): string | null {
  const tagged = event.tags?.route;
  if (typeof tagged === 'string') return tagged;
  if (typeof event.transaction !== 'string') return null;
  const route = event.transaction.replace(HTTP_METHOD_PREFIX, '');
  return URL_LIKE.test(route) && scrubPathname(route) === route ? route : null;
}

/**
 * Rewrite the request URL through the route pattern and drop every field that
 * can carry PII: body data, cookies, headers, and the raw query string.
 */
function scrubRequest(request: NonNullable<Event['request']>, route: string | null): void {
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
function scrubException(exception: NonNullable<Event['exception']>): void {
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

/** Copy a breadcrumb's data object with its URLs scrubbed (see scrubAttributes). */
function scrubBreadcrumbData(data: Record<string, unknown>): Record<string, unknown> {
  const scrubbed = { ...data };
  scrubAttributes(scrubbed);
  return scrubbed;
}

/**
 * Drop the SDK-collected breadcrumbs we never want sent (see
 * filterIncomingBreadcrumb) and scrub URLs in the survivors' data.
 */
function scrubBreadcrumbs(breadcrumbs: Breadcrumb[]): Breadcrumb[] {
  return breadcrumbs
    .filter(
      (b) => b.category !== 'ui.click' && b.category !== 'ui.input' && b.category !== 'console'
    )
    .map((b) =>
      b.data && typeof b.data === 'object' ? { ...b, data: scrubBreadcrumbData(b.data) } : b
    );
}

/** Rewrite every string entry of an (unknown) array in place. */
function scrubStringsInPlace(list: unknown, scrub: (value: string) => string): void {
  if (!Array.isArray(list)) return;
  list.forEach((value, i) => {
    if (typeof value === 'string') list[i] = scrub(value);
  });
}

/** A transaction's root-span attributes and its child spans. */
function scrubTracing(event: Event): void {
  const trace = event.contexts?.trace;
  if (trace?.data && typeof trace.data === 'object') scrubAttributes(trace.data);
  if (Array.isArray(event.spans)) event.spans.forEach(scrubSpan);
}

/**
 * Feedback keeps the message the parent chose to send; the page URL is
 * scrubbed like any other and contact fields never leave (the form hides them,
 * this covers a future config change).
 */
function scrubFeedback(feedback: Record<string, unknown>): void {
  if (typeof feedback.url === 'string') feedback.url = scrubUrlString(feedback.url);
  delete feedback.contact_email;
  delete feedback.name;
}

/**
 * Scrub any event type in place: errors (`beforeSend`), transactions
 * (`beforeSendTransaction`), and the browser's replay/feedback events (routed
 * through the privacy integration in hooks.client.ts because `beforeSend`
 * never sees them). Returns null — dropping the event — if scrubbing throws.
 */
export function scrubEvent<E extends Event>(event: E): E | null {
  try {
    if (!event || typeof event !== 'object') return null;

    const route = eventRoute(event);

    if (event.request) scrubRequest(event.request, route);
    if (typeof event.transaction === 'string') event.transaction = scrubName(event.transaction);

    delete event.user;

    if (typeof event.message === 'string') event.message = REDACTED;
    if (event.exception) scrubException(event.exception);

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = scrubBreadcrumbs(event.breadcrumbs);
    }

    scrubTracing(event);

    const feedback = event.contexts?.feedback;
    if (feedback) scrubFeedback(feedback);

    // replay_event only: every page URL and navigation segment name the
    // recorded session visited.
    scrubStringsInPlace('urls' in event ? event.urls : undefined, scrubUrlString);
    scrubStringsInPlace('segment_names' in event ? event.segment_names : undefined, scrubName);

    return event;
  } catch {
    return null;
  }
}

/** The payload of a Sentry custom replay frame (breadcrumb or performanceSpan). */
type RecordingPayload = {
  category?: unknown;
  message?: unknown;
  description?: unknown;
  data?: { node?: { id?: unknown; tagName?: unknown }; [key: string]: unknown };
};

/** The fields of a Sentry custom replay frame this scrubber touches. */
type RecordingFrame = {
  data?: {
    tag?: unknown;
    payload?: RecordingPayload;
  };
};

/**
 * Breadcrumb frames: console output is dropped (it can echo anything), and
 * `ui.*` frames lose the CSS selector message and keep only the replay node
 * id/tag, because selectors embed attribute values such as `aria-label`
 * (which name allergens in this app). Returns false when the frame must go.
 */
function keepBreadcrumbFrame(payload: RecordingPayload): boolean {
  if (payload.category === 'console') return false;
  if (typeof payload.category === 'string' && payload.category.startsWith('ui.')) {
    delete payload.message;
    const node = payload.data?.node;
    if (node && payload.data) payload.data.node = { id: node.id, tagName: node.tagName };
  }
  return true;
}

/**
 * Replay `beforeAddRecordingEvent`: scrub the frames the replay integration
 * records around the (already masked) DOM snapshots. Replay only hands its own
 * custom frames to this hook; rrweb's frames (including the Meta frame with
 * the page URL) bypass it and are scrubbed by the tunnel — see
 * scrubRecordingFrames.
 *
 * - Breadcrumb frames: see keepBreadcrumbFrame; URLs in their data are scrubbed.
 * - performanceSpan frames name the fetched/navigated URL.
 */
export function scrubRecordingEvent<R extends object>(event: R): R | null {
  // Every field of RecordingFrame is optional and type-checked before use.
  const frame: RecordingFrame = event;
  const data = frame.data;
  if (!data || typeof data !== 'object') return event;

  const payload = data.payload;
  if (!payload || typeof payload !== 'object') return event;

  if (data.tag === 'breadcrumb' && !keepBreadcrumbFrame(payload)) return null;
  if (data.tag === 'performanceSpan' && typeof payload.description === 'string') {
    payload.description = scrubName(payload.description);
  }

  if (payload.data && typeof payload.data === 'object') {
    payload.data = scrubBreadcrumbData(payload.data);
  }
  return event;
}

/** rrweb `EventType.Meta`: emitted with every full snapshot. */
const RRWEB_META_EVENT = 4;

// Attributes rrweb resolves to absolute URLs *before* applying Replay's
// maskAttributes, so `maskAttributes: ['href']` never masks them: every link
// in a snapshot would carry raw child ids and query strings.
const URL_ATTRIBUTES: Record<string, true> = {
  href: true,
  src: true,
  srcset: true,
  'xlink:href': true,
  background: true,
  data: true
};

/** Scrub URL-bearing values of one rrweb `attributes` map (snapshot node or mutation). */
function scrubUrlAttributes(attributes: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (Object.hasOwn(URL_ATTRIBUTES, name) && typeof value === 'string') {
      attributes[name] = scrubUrlString(value);
    }
  }
}

/**
 * Walk a recording frame and scrub every `attributes` map in it: the
 * serialized DOM of full snapshots (node.attributes, recursively through
 * childNodes) and incremental mutations (adds[].node.attributes and
 * attributes[].attributes).
 */
function scrubDomAttributes(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(scrubDomAttributes);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attributes' && isRecord(child) && !Array.isArray(child)) scrubUrlAttributes(child);
    scrubDomAttributes(child);
  }
}

/**
 * Scrub a decoded replay recording (the rrweb event array inside a
 * `replay_recording` envelope item) in place. Used server-side by the
 * /monitoring tunnel, because these frames never pass through a client-side
 * hook: the Meta frame records `location.href`, and snapshots/mutations carry
 * every link's absolute URL (see URL_ATTRIBUTES).
 */
export function scrubRecordingFrames(frames: unknown): void {
  if (!Array.isArray(frames)) return;
  for (const frame of frames) {
    if (!isRecord(frame)) continue;
    const data = frame.data;
    if (frame.type === RRWEB_META_EVENT && isRecord(data) && typeof data.href === 'string') {
      data.href = scrubUrlString(data.href);
    }
    scrubDomAttributes(data);
  }
}

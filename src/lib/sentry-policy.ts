/**
 * What Diversif reports to Sentry, for both runtimes: the Sentry.init options
 * (which scrubber runs at which SDK hook, sampling, the tunnel, what is never
 * collected), Session Replay's options, and the one "report this?" decision
 * that client handleError, server handleError, the handle chain and every
 * beforeSend ask. A new rule, or an SDK upgrade that moves a hook, is an edit
 * here; the init files only pass their environment and integrations in.
 *
 * - Client: `Sentry.init(clientSentryOptions(env, integrations))`, then
 *   `export const handleError = handleClientError`; Replay, once its chunk
 *   loads, is `Sentry.replayIntegration(replayOptions)`.
 * - Server: `Sentry.init(serverSentryOptions(process.env))`;
 *   `export const handleError = handleServerError`, and the app's handle calls
 *   `tagHandleChainError` on any error escaping it.
 *
 * Every error the hooks report carries an `errorId` tag: the id the error page
 * shows (« Réf : ») and a problem report quotes, which links a parent's report
 * to the Sentry issue and, on the server, to the `[diversif:error]` stderr
 * line. The scrub rules themselves live in #lib/sentry.ts; the /monitoring
 * tunnel also scrubs the replay frames no SDK hook sees.
 */

import * as Sentry from '@sentry/sveltekit';
import type { BrowserOptions, NodeOptions } from '@sentry/sveltekit';
import { isHttpError, isRedirect, type RequestEvent } from '@sveltejs/kit';
import type { HandleClientError, HandleServerError } from '@sveltejs/kit/hooks';
import { isNetworkFailure } from '#lib/network-failure.js';
import * as m from '#lib/paraglide/messages.js';
import {
  clientRouteTag,
  filterIncomingBreadcrumb,
  scrubBrowserEvent,
  scrubEvent,
  scrubLog,
  scrubPathname,
  scrubRecordingEvent,
  scrubSpan
} from '#lib/sentry.js';

type Runtime = 'client' | 'server';

/**
 * An error as a hook sees it. `kind` is SvelteKit's classification, known only
 * where SvelteKit caught the error (handleError, and the handle chain, which
 * predicts it). The SDK's own captures (its global handlers, its load wrapper,
 * sentryHandle) reach beforeSend with the error alone. So a rule on `kind` or
 * status can only fire in handleError, while a rule on the error itself fires
 * at every hook: a network failure is dropped wherever it surfaces.
 */
type Caught = { kind?: string; error: unknown };

/**
 * - expected: an error(...) thrown by route code; its body is the answer.
 * - quiet: a 4xx: a routing dead-end (SvelteKit's "no matching route" for
 *   typos, stale bookmarks, bots scanning for /wp-admin, a data load throwing
 *   notFound), not a bug.
 * - unreachable: the browser could not reach the server; the parent is told to
 *   check their connection, with no errorId since no event exists to match.
 * - report: a bug, sent to Sentry.
 */
type Verdict = 'expected' | 'quiet' | 'unreachable' | 'report';

/** SvelteKit's message for an unknown error, and the only one the error page gets. */
const INTERNAL_ERROR = 'Internal Error';

/**
 * The status and message SvelteKit renders a caught error with: an unknown
 * error is a thrown exception, rendered as a 500, while framework and
 * validation errors carry SvelteKit's own. Not for 'app' errors, whose `error`
 * is the body the route chose (verdict: expected).
 */
function statusAndMessage({ kind, error }: Caught): { status: number; message: string } {
  return kind === 'unknown'
    ? { status: 500, message: INTERNAL_ERROR }
    : (error as { status: number; message: string });
}

/**
 * The one "report this?" rule.
 *
 * A network failure (isNetworkFailure: offline, a dropped connection, a chunk
 * a redeploy removed) is not a bug, and hover preloads would otherwise report
 * one for a page the parent never opened. Some never reach handleError:
 * SvelteKit 3 imports the root layout and root error chunks before hydrating,
 * outside its try/catch, so a failed load reaches the SDK's global
 * onunhandledrejection handler instead (DIVERSIF-D); the SDK's universal-load
 * wrapper reports load errors before handleError sees them. Not
 * `ignoreErrors`: it matches the message alone, while isNetworkFailure also
 * requires the TypeError.
 *
 * In the browser, SvelteKit only raises a 5xx `framework` error when an
 * enhanced form gets a non-JSON error page, i.e. Traefik or Cloudflare
 * answering while Coolify swaps the container: the server is unreachable. The
 * app's own 5xx come back as JSON the server hook already reported.
 */
function verdict(runtime: Runtime, caught: Caught): Verdict {
  const { kind, error } = caught;
  if (kind === 'app') return 'expected';
  if (kind && statusAndMessage(caught).status < 500) return 'quiet';
  if (runtime === 'client' && (kind === 'framework' || isNetworkFailure(error))) {
    return 'unreachable';
  }
  return 'report';
}

/** Whether `value` can key the WeakMap of handle-chain errorIds. */
function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function newErrorId(): string {
  return crypto.getRandomValues(new Uint32Array(1))[0].toString(16).padStart(8, '0');
}

// Same mechanism Sentry's own handleErrorWithSentry reports: SvelteKit caught
// the error, but no app code handled it, so the issue counts as unhandled (and
// a crashed session in release health).
const HANDLE_ERROR_MECHANISM = { type: 'auto.function.sveltekit.handle_error', handled: false };

/** Same-origin path the browser SDK posts envelopes to (src/routes/monitoring/+server.ts). */
const SENTRY_TUNNEL_PATH = '/monitoring';

/**
 * SDK v11 replaced `sendDefaultPii` with `dataCollection`, whose defaults
 * collect user info, cookies, request/response bodies and database query
 * data, and an unknown `sendDefaultPii: false` is silently ignored, so the old
 * opt-out must be restated here. This is the baseline the v11 migration guide
 * gives for keeping v10's default behaviour; scrubEvent/scrubSpan/scrubLog
 * still strip what the SDK attaches anyway.
 */
const DATA_COLLECTION: NonNullable<Parameters<typeof Sentry.init>[0]['dataCollection']> = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] }
  },
  httpBodies: [],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false }
};

/**
 * Parse a `*_SAMPLE_RATE` env value. Anything that is not a number in [0, 1]
 * (unset, empty, typo, out of range) falls back to the documented default
 * rather than silently sampling everything or nothing.
 */
function parseSampleRate(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

/** The options both runtimes share, so an SDK upgrade edits them once. */
function sharedOptions(environment: string | undefined, tracesSampleRate: string | undefined) {
  return {
    environment: environment || 'production',
    // Inlined at build time by Vite's `define` (vite.config.ts), so the server
    // and the client bundle share one SHA. vite.config.ts emits either a
    // string literal or the bare `undefined` token.
    release: __SENTRY_RELEASE__,
    tracesSampleRate: parseSampleRate(tracesSampleRate, 0.1),
    dataCollection: DATA_COLLECTION,
    // v11 streams spans by default, which bypasses beforeSendTransaction (and
    // ignoreTransactions on the server). The static lifecycle keeps one
    // scrubbed, filterable transaction per trace, as in v10; beforeSendSpan
    // must then be wrapped.
    traceLifecycle: 'static' as const,
    beforeSendSpan: Sentry.withStaticSpan(scrubSpan),
    beforeBreadcrumb: filterIncomingBreadcrumb
  };
}

type Integration = Exclude<BrowserOptions['defaultIntegrations'], false | undefined>[number];

/** The browser-side Sentry variables (src/env.ts); unset ones are ''. */
type ClientSentryEnv = {
  PUBLIC_SENTRY_DSN: string;
  PUBLIC_SENTRY_ENVIRONMENT: string;
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE: string;
  PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: string;
  PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: string;
};

/** Scrubs the browser payloads that never reach a beforeSend* hook. */
const privacyIntegration: Integration = {
  name: 'DiversifPrivacy',
  // beforeSend never sees replay or feedback events; scrub them here.
  processEvent: (event) =>
    event.type === 'replay_event' || event.type === 'feedback' ? scrubBrowserEvent(event) : event,
  // Release-health sessions are not events either: the SDK copies
  // navigator.userAgent into every one, whatever dataCollection says.
  setup: (client) => {
    client.on('beforeSendSession', (session) => {
      if ('userAgent' in session) session.userAgent = undefined;
    });
  }
};

/**
 * Options for the browser's Sentry.init. `integrations` are the caller's
 * (built with SDK constructors); the privacy integration is added after them.
 * An empty DSN disables browser capture.
 */
export function clientSentryOptions(
  env: ClientSentryEnv,
  integrations: Integration[]
): BrowserOptions {
  return {
    ...sharedOptions(env.PUBLIC_SENTRY_ENVIRONMENT, env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE),
    dsn: env.PUBLIC_SENTRY_DSN,
    // Envelopes go to our own origin, which relays them to Sentry
    // (src/routes/monitoring/+server.ts): Sentry never sees a parent's IP
    // address, and CSP connect-src stays 'self'.
    tunnel: SENTRY_TUNNEL_PATH,
    // The SDK posts binary envelopes (compressed replay segments) without a
    // Content-Type, and SvelteKit hands a body-less Request to any endpoint
    // whose request lacks one, so the tunnel would receive nothing. Declaring
    // the envelope type also keeps these same-origin posts out of SvelteKit's
    // form-submission CSRF check, which only concerns form content types.
    transportOptions: { headers: { 'Content-Type': 'application/x-sentry-envelope' } },
    // Session Replay defaults to error-only: the last minute before a captured
    // error is kept in memory and sent with it; no session is recorded
    // otherwise unless an operator raises the session rate. The recorder itself
    // is added once its chunk has loaded (#lib/sentry-replay-loader.ts).
    replaysSessionSampleRate: parseSampleRate(env.PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
    replaysOnErrorSampleRate: parseSampleRate(env.PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1),
    integrations: [...integrations, privacyIntegration],
    // A browser error has no stderr line behind it, so its message is scrubbed
    // rather than redacted (scrubBrowserEvent).
    beforeSend: (event, hint) =>
      verdict('client', { error: hint.originalException }) === 'report'
        ? scrubBrowserEvent(event)
        : null,
    beforeSendTransaction: scrubBrowserEvent
  };
}

/**
 * Options for Session Replay's integration, which #lib/sentry-replay.ts adds
 * once its chunk has loaded; the sample rates are clientSentryOptions'.
 */
export const replayOptions: NonNullable<Parameters<typeof Sentry.replayIntegration>[0]> = {
  // The SDK defaults, restated because they are the privacy contract:
  // every text node, input value and image/SVG is masked or blocked.
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  // Default masked attributes plus the ones that carry child/entry ids,
  // dates or food names in this app's markup. rrweb resolves href/src to
  // absolute URLs before this list applies, so links are scrubbed
  // server-side by the /monitoring tunnel instead (scrubRecordingFrames).
  maskAttributes: ['title', 'placeholder', 'aria-label', 'alt', 'action', 'value', 'datetime'],
  // Keep the replay session in memory only: nothing is written to
  // sessionStorage, so the three strictly-necessary cookies stay the only
  // client-side storage (see /cookies).
  stickySession: false,
  // networkDetailAllowUrls stays at its empty default: no request or
  // response bodies/headers are recorded.
  beforeAddRecordingEvent: scrubRecordingEvent
};

/**
 * Client handleError. Only a reported error gets an errorId; a 4xx gets the
 * generic message, as the server's error page would.
 *
 * Tags omit `method` (which the server hook records): SvelteKit's
 * `NavigationEvent` has no `request` property in the browser, and there is no
 * reliable equivalent (clicks, popstate, programmatic navigations all reach
 * here without a method). A failed `__data.json` fetch reaches this hook with
 * the page key (`/child/18/guide?…`) as `route.id` instead of the route
 * pattern; see clientRouteTag.
 */
export const handleClientError: HandleClientError = (caught) => {
  const { error, event } = caught;
  switch (verdict('client', caught)) {
    case 'expected':
      return;
    case 'quiet':
      return { message: INTERNAL_ERROR };
    case 'unreachable':
      return { message: m.errorsNetwork() };
  }
  const errorId = newErrorId();
  Sentry.captureException(error, {
    mechanism: HANDLE_ERROR_MECHANISM,
    captureContext: {
      tags: {
        errorId,
        status: statusAndMessage(caught).status,
        route: clientRouteTag(event.route?.id, event.params)
      }
    }
  });
  return { message: INTERNAL_ERROR, errorId };
};

/** The server-side Sentry variables; `process.env` is passed whole. */
type ServerSentryEnv = {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
  [name: string]: string | undefined;
};

/** Options for the server's Sentry.init. */
export function serverSentryOptions(env: ServerSentryEnv): NodeOptions {
  return {
    ...sharedOptions(env.SENTRY_ENVIRONMENT, env.SENTRY_TRACES_SAMPLE_RATE),
    dsn: env.SENTRY_DSN || '',
    // Every browser envelope relayed by the tunnel would otherwise produce its
    // own server transaction; `sveltekit.handle.root` is the root span of a
    // request matching no route (bot scans, 404s), which sentryHandle never
    // renames.
    ignoreTransactions: [`POST ${SENTRY_TUNNEL_PATH}`, 'sveltekit.handle.root'],
    // Server messages are redacted: their full text is in the stderr line.
    // No rule drops a server error today, so this verdict is always 'report';
    // asking it anyway means a future rule on the error also reaches the
    // errors sentryHandle and the SDK capture without handleError.
    beforeSend: (event, hint) =>
      verdict('server', { error: hint.originalException }) === 'report' ? scrubEvent(event) : null,
    beforeSendTransaction: scrubEvent,
    // Structured operational logs (boot, migrations, cleanup, shutdown) are
    // sent explicitly via Sentry.logger (v11 captures logs whenever that API
    // is called, there is no enableLogs option). Console output is
    // deliberately NOT captured: handleServerError's `[diversif:error]` line
    // carries the user id and raw path.
    beforeSendLog: scrubLog
  };
}

/** The tags a reported server error carries, on its event or its request's scope. */
function serverTags(errorId: string, status: number, event: RequestEvent) {
  return { errorId, status, method: event.request.method, route: event.route?.id ?? null };
}

/**
 * The operator-side trail of a reported server error: the Sentry event drops
 * user.id and redacts the message, so this stderr line (Coolify streams it)
 * holds them, indexed by the errorId. The path gets the same scrub as the
 * event so child/food ids don't end up in the platform's log aggregator; the
 * route pattern, when SvelteKit matched one, keeps all of its debugging value.
 */
function logServerError(
  { error, event }: Parameters<HandleServerError>[0],
  errorId: string,
  status: number,
  message: string
): void {
  const err = error as Error | null;
  console.error(
    '[diversif:error]',
    JSON.stringify({
      id: errorId,
      method: event.request.method,
      path: scrubPathname(event.url.pathname, event.route?.id ?? null),
      userId: event.locals.user?.id ?? null,
      status,
      message,
      name: err?.name,
      msg: err?.message,
      stack: err?.stack
    })
  );
}

/** errorIds minted by tagHandleChainError, for handleServerError to reuse. */
const handleChainErrorIds = new WeakMap<object, string>();

/**
 * An unexpected error escaping the app's handle (e.g. session validation on a
 * locked database) is captured by sentryHandle on its way out, before
 * SvelteKit calls handleError, whose own capture of the same error Sentry
 * then drops as a duplicate. So mint the errorId here: tag the request's
 * isolation scope, which sentryHandle's capture reads, and hand the same id to
 * handleServerError for the error page. Redirects are control flow and an
 * error(...) is an 'app' error handleServerError won't report; anything else
 * is tagged as the 500 SvelteKit renders for an unknown error.
 */
export function tagHandleChainError(error: unknown, event: RequestEvent): void {
  if (!isObject(error) || isRedirect(error)) return;
  const kind = isHttpError(error) ? 'app' : 'unknown';
  if (verdict('server', { kind, error }) !== 'report') return;
  const errorId = newErrorId();
  handleChainErrorIds.set(error, errorId);
  Sentry.getIsolationScope().setTags(serverTags(errorId, 500, event));
}

/**
 * Server handleError: a reported error gets the stderr line and a Sentry
 * event, and the error page gets only its errorId. A 4xx also gets an errorId
 * (no event, no stderr line) so /+error.svelte can show it for a support
 * request.
 */
export const handleServerError: HandleServerError = (caught) => {
  const { error, event } = caught;
  const outcome = verdict('server', caught);
  if (outcome === 'expected') return;
  const errorId = (isObject(error) && handleChainErrorIds.get(error)) || newErrorId();
  if (outcome === 'quiet') return { message: INTERNAL_ERROR, errorId };
  const { status, message } = statusAndMessage(caught);
  logServerError(caught, errorId, status, message);
  Sentry.captureException(error, {
    mechanism: HANDLE_ERROR_MECHANISM,
    captureContext: { tags: serverTags(errorId, status, event) }
  });
  return { message: INTERNAL_ERROR, errorId };
};

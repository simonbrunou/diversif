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
 * (chunk imports) or only SvelteKit's (fetches), so they pile into a handful
 * of Sentry issues whatever the route (DIVERSIF-4). A redeploy that removes
 * the previous build's hashed chunks fails the same way for a tab still on
 * the old build. Used by the Sentry hooks (not reported) and boot recovery
 * (the app could not start).
 */
export function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof TypeError && NETWORK_FAILURE_MESSAGES.some((re) => re.test(error.message))
  );
}

/**
 * Sentry tunnel endpoint (see SENTRY_TUNNEL_PATH in $lib/sentry.ts).
 *
 * The browser SDK is configured to POST every envelope (errors, traces,
 * replays, user feedback) here instead of directly to ingest.sentry.io.
 * Reasons this exists rather than pointing the SDK straight at Sentry:
 *
 *  - Privacy: a direct browser->Sentry request leaks the parent's public IP
 *    to a third party on every page. Routed through this same-origin path,
 *    Sentry only ever sees this server's IP.
 *  - CSP: connect-src can stay same-origin — no *.sentry.io / *.ingest.*
 *    entry needed, which keeps the policy tight and legible.
 *  - Ad-blocker resilience: many lists block *.sentry.io / "sentry" in the
 *    URL outright, silently dropping error/replay data. A same-origin path
 *    with a generic name is not on those lists.
 *
 * We only relay envelopes whose header `dsn` matches our own configured
 * project — otherwise this endpoint would be an open relay letting anyone
 * push arbitrary data into (or spend the quota of) any Sentry project.
 *
 * adapter-node's BODY_SIZE_LIMIT (128KB recommended in .env.example) caps how large an
 * envelope can be before SvelteKit itself rejects the request with 413, so we
 * don't enforce our own size limit on top of it. Measured sizes and the
 * trade-off are documented next to BODY_SIZE_LIMIT in .env.example.
 */

import type { RequestHandler } from './$types';

interface ParsedDsn {
  /** `${protocol}//${host}`, e.g. "https://o1.ingest.de.sentry.io". */
  origin: string;
  /** Leading-slash path prefix before `/<projectId>`, or '' when there is none. */
  pathPrefix: string;
  publicKey: string;
  projectId: string;
}

/**
 * Parse a Sentry DSN (`https://<publicKey>[:secret]@<host>[/<prefix>]/<projectId>`).
 * Returns null for anything unparseable, missing a public key, or missing a
 * project id — both the configured DSN and every inbound envelope's DSN are
 * validated through this same helper.
 */
function parseDsn(raw: string): ParsedDsn | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const publicKey = url.username;
  if (!publicKey) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  const projectId = segments.pop();
  if (!projectId) return null;
  return {
    origin: `${url.protocol}//${url.host}`,
    pathPrefix: segments.length > 0 ? `/${segments.join('/')}` : '',
    publicKey,
    projectId
  };
}

// Rate-limit signalling headers the browser SDK reads to back off; nothing
// else from the upstream response (e.g. Set-Cookie) is ever relayed to the
// client.
const FORWARDED_RESPONSE_HEADERS = ['x-sentry-rate-limits', 'retry-after'];

export const POST: RequestHandler = async ({ request }) => {
  // Read per request (not module scope) so tests can set/unset the env var,
  // and so the tunnel turns off the moment browser capture is disabled.
  const configuredDsn = process.env.PUBLIC_SENTRY_DSN;
  const configured = configuredDsn ? parseDsn(configuredDsn) : null;
  if (!configured) return new Response(null, { status: 404 });

  // Envelopes may contain binary payloads (gzip-compressed replay
  // segments), so the body is read and forwarded as raw bytes — never
  // decoded as text as a whole.
  const bytes = new Uint8Array(await request.arrayBuffer());
  const newlineIndex = bytes.indexOf(0x0a);
  if (newlineIndex === -1) return new Response(null, { status: 400 });

  let header: unknown;
  try {
    const headerText = new TextDecoder().decode(bytes.subarray(0, newlineIndex));
    header = JSON.parse(headerText);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (
    typeof header !== 'object' ||
    header === null ||
    !('dsn' in header) ||
    typeof header.dsn !== 'string'
  ) {
    return new Response(null, { status: 400 });
  }

  // Reject anything not addressed to our own project outright, before ever
  // calling fetch — this is what keeps the endpoint from being usable as an
  // open relay into arbitrary Sentry hosts/projects.
  const envelopeDsn = parseDsn(header.dsn);
  if (
    !envelopeDsn ||
    envelopeDsn.origin !== configured.origin ||
    envelopeDsn.publicKey !== configured.publicKey ||
    envelopeDsn.projectId !== configured.projectId
  ) {
    return new Response(null, { status: 400 });
  }

  const ingestUrl = `${configured.origin}${configured.pathPrefix}/api/${configured.projectId}/envelope/`;

  let upstream: Response;
  try {
    // Deliberately no inbound headers are forwarded (no cookie, user-agent,
    // x-forwarded-for, cf-connecting-ip, referer, ...): the whole point of
    // the tunnel is that Sentry sees only this server, never the client.
    upstream = await fetch(ingestUrl, {
      method: 'POST',
      body: bytes,
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  return new Response(null, { status: upstream.status, headers });
};

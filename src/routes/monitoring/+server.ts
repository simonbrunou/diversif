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
 * adapter-node's BODY_SIZE_LIMIT (128KB recommended in .env.example) caps how
 * large an envelope can be before SvelteKit itself rejects the request with
 * 413; measured sizes and the trade-off are documented next to it. Because the
 * tunnel works for unauthenticated callers — outbound requests, and decoding
 * replay recordings — it is also throttled per client address, and
 * decompression is capped so a small gzip bomb cannot exhaust memory.
 */

import { deflateSync, gzipSync, unzipSync } from 'node:zlib';
import { scrubRecordingFrames } from '$lib/sentry';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

// A parent's tab sends a few envelopes per navigation, plus one replay segment
// every 5 s once an error has started a recording; 4 per second per address
// leaves room for co-parents behind the same NAT.
const TUNNEL_LIMIT = { name: 'sentry-tunnel', limit: 240, windowMs: 60_000 };

// Recordings measure ~60 KB compressed (≈1 MB of JSON); anything that inflates
// past this is not a real replay segment.
const MAX_RECORDING_BYTES = 8 * 1024 * 1024;

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

const NEWLINE = 0x0a;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

interface EnvelopeItem {
  header: Record<string, unknown>;
  payload: Uint8Array;
}

/** Index just past an item's payload starting at `offset`. Throws on a bad length. */
function payloadEnd(bytes: Uint8Array, offset: number, length: unknown): number {
  if (length === undefined) {
    const end = bytes.indexOf(NEWLINE, offset);
    return end === -1 ? bytes.length : end;
  }
  // A negative or fractional length would move the parser backwards and never
  // end its loop: one crafted request could pin the server.
  if (!Number.isSafeInteger(length) || Number(length) < 0) throw new Error('item length');
  const end = offset + Number(length);
  if (end > bytes.length) throw new Error('truncated item');
  return end;
}

/** Split the items following the envelope header line. Throws on malformed input. */
function parseItems(bytes: Uint8Array, start: number): EnvelopeItem[] {
  const items: EnvelopeItem[] = [];
  let offset = start;
  while (offset < bytes.length) {
    let headerEnd = bytes.indexOf(NEWLINE, offset);
    if (headerEnd === -1) headerEnd = bytes.length;
    const header: unknown = JSON.parse(decoder.decode(bytes.subarray(offset, headerEnd)));
    if (typeof header !== 'object' || header === null) throw new Error('item header');
    offset = headerEnd + 1;
    const end = payloadEnd(bytes, offset, 'length' in header ? header.length : undefined);
    items.push({ header: { ...header }, payload: bytes.subarray(offset, end) });
    offset = end + 1;
  }
  return items;
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * A `replay_recording` payload is a `{"segment_id":N}` line followed by the
 * rrweb event array — gzip (Replay's compression worker), zlib, or plain JSON
 * (no worker). Decode it, scrub the frames the client could not reach (see
 * scrubRecordingFrames) and re-encode it the same way.
 */
function scrubReplayRecording(payload: Uint8Array): Uint8Array {
  const segmentEnd = payload.indexOf(NEWLINE);
  if (segmentEnd === -1) throw new Error('replay segment header');
  const body = payload.subarray(segmentEnd + 1);
  const gzip = body[0] === 0x1f && body[1] === 0x8b;
  const zlib = body[0] === 0x78;
  const json = gzip || zlib ? unzipSync(body, { maxOutputLength: MAX_RECORDING_BYTES }) : body;
  if (json.length > MAX_RECORDING_BYTES) throw new Error('recording too large');
  const frames: unknown = JSON.parse(decoder.decode(json));
  scrubRecordingFrames(frames);
  const scrubbed = encoder.encode(JSON.stringify(frames));
  const encoded = gzip ? gzipSync(scrubbed) : zlib ? deflateSync(scrubbed) : scrubbed;
  return concat([payload.subarray(0, segmentEnd + 1), encoded]);
}

/**
 * Return the envelope to forward: byte-identical unless it carries a replay
 * recording, which is rebuilt with scrubbed frames and corrected item lengths.
 */
function scrubEnvelope(bytes: Uint8Array<ArrayBuffer>, headerEnd: number): Uint8Array<ArrayBuffer> {
  const items = parseItems(bytes, headerEnd + 1);
  if (!items.some((item) => item.header.type === 'replay_recording')) return bytes;
  const parts: Uint8Array[] = [bytes.subarray(0, headerEnd)];
  for (const item of items) {
    const payload =
      item.header.type === 'replay_recording' ? scrubReplayRecording(item.payload) : item.payload;
    if ('length' in item.header) item.header.length = payload.length;
    parts.push(encoder.encode(`\n${JSON.stringify(item.header)}\n`), payload);
  }
  return concat(parts);
}

export const POST: RequestHandler = async (event) => {
  // Read per request (not module scope) so tests can set/unset the env var,
  // and so the tunnel turns off the moment browser capture is disabled.
  const configuredDsn = process.env.PUBLIC_SENTRY_DSN;
  const configured = configuredDsn ? parseDsn(configuredDsn) : null;
  if (!configured) return new Response(null, { status: 404 });

  const rl = checkRateLimit(TUNNEL_LIMIT, clientKey(event));
  if (!rl.allowed) {
    // The browser SDK reads Retry-After on 429 and backs off.
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSeconds) }
    });
  }

  // Envelopes may contain binary payloads (gzip-compressed replay
  // segments), so the body is read and forwarded as raw bytes — never
  // decoded as text as a whole.
  const bytes = new Uint8Array(await event.request.arrayBuffer());
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

  let body: Uint8Array<ArrayBuffer>;
  try {
    body = scrubEnvelope(bytes, newlineIndex);
  } catch {
    // Unparseable items can't be scrubbed, so they are never forwarded.
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
      body,
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

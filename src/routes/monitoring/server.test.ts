import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { POST } from './+server';

const ORIGINAL_DSN = process.env.PUBLIC_SENTRY_DSN;

afterEach(() => {
  if (ORIGINAL_DSN === undefined) delete process.env.PUBLIC_SENTRY_DSN;
  else process.env.PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
});

// Envelope header + one item header + a payload containing non-UTF-8 bytes
// (as a real gzip-compressed replay segment would), to prove the route
// forwards the body as raw bytes rather than round-tripping it through text.
function buildEnvelope(dsn: string): Uint8Array {
  const encoder = new TextEncoder();
  const headerLine = encoder.encode(`${JSON.stringify({ dsn })}\n`);
  const itemHeaderLine = encoder.encode(`${JSON.stringify({ type: 'attachment', length: 3 })}\n`);
  const payload = new Uint8Array([0xff, 0x00, 0x8b]);
  const out = new Uint8Array(headerLine.length + itemHeaderLine.length + payload.length);
  out.set(headerLine, 0);
  out.set(itemHeaderLine, headerLine.length);
  out.set(payload, headerLine.length + itemHeaderLine.length);
  return out;
}

function makeRequest(body: Uint8Array, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/monitoring', { method: 'POST', body, headers });
}

function post(request: Request): Promise<Response> {
  return POST({ request } as unknown as Parameters<typeof POST>[0]);
}

const CONFIGURED_DSN = 'https://abc@o1.ingest.de.sentry.io/42';

describe('POST /monitoring', () => {
  it('returns 404 and never calls fetch when PUBLIC_SENTRY_DSN is unset', async () => {
    delete process.env.PUBLIC_SENTRY_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when PUBLIC_SENTRY_DSN is set to an empty string', async () => {
    process.env.PUBLIC_SENTRY_DSN = '';
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when PUBLIC_SENTRY_DSN is not a valid URL', async () => {
    process.env.PUBLIC_SENTRY_DSN = 'not-a-valid-dsn';
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when PUBLIC_SENTRY_DSN has no public key (username)', async () => {
    process.env.PUBLIC_SENTRY_DSN = 'https://o1.ingest.de.sentry.io/42';
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when PUBLIC_SENTRY_DSN has no project id', async () => {
    process.env.PUBLIC_SENTRY_DSN = 'https://abc@o1.ingest.de.sentry.io';
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards a matching envelope verbatim, strips client-identifying headers, and mirrors the upstream status', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const bytes = buildEnvelope(CONFIGURED_DSN);
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    );
    const request = makeRequest(bytes, {
      cookie: 'session=secret',
      'x-forwarded-for': '203.0.113.5',
      'user-agent': 'TestAgent/1.0'
    });

    const response = await post(request);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://o1.ingest.de.sentry.io/api/42/envelope/');
    expect(init?.body).toBeInstanceOf(Uint8Array);
    if (init?.body instanceof Uint8Array) {
      expect(init.body).toEqual(bytes);
    }
    const sentHeaders = new Headers(init?.headers);
    expect(sentHeaders.get('Content-Type')).toBe('application/x-sentry-envelope');
    expect(sentHeaders.has('cookie')).toBe(false);
    expect(sentHeaders.has('x-forwarded-for')).toBe(false);
    expect(sentHeaders.has('user-agent')).toBe(false);
    expect(response.status).toBe(200);
  });

  it('mirrors rate-limit headers from upstream but drops unrelated headers', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: {
          'X-Sentry-Rate-Limits': '60:organization',
          'Retry-After': '60',
          'set-cookie': 'upstream=1'
        }
      })
    );

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(429);
    expect(response.headers.get('x-sentry-rate-limits')).toBe('60:organization');
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects an envelope DSN pointing at a different host', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(makeRequest(buildEnvelope('https://abc@evil.example/42')));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an envelope DSN with a different project id', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(
      makeRequest(buildEnvelope('https://abc@o1.ingest.de.sentry.io/99'))
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an envelope DSN with a different public key', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));

    const response = await post(
      makeRequest(buildEnvelope('https://zzz@o1.ingest.de.sentry.io/42'))
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a body whose header line is not valid JSON', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));
    const bytes = new TextEncoder().encode('not json\n{}\n');

    const response = await post(makeRequest(bytes));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a body with no newline at all', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));
    const bytes = new TextEncoder().encode(JSON.stringify({ dsn: CONFIGURED_DSN }));

    const response = await post(makeRequest(bytes));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a header line missing the dsn field', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not be called'));
    const bytes = new TextEncoder().encode('{"event_id":"x"}\n{}\n');

    const response = await post(makeRequest(bytes));

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns 502 when the upstream fetch fails', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));

    const response = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(response.status).toBe(502);
  });

  it('handles a DSN path prefix (self-hosted Sentry/GlitchTip)', async () => {
    const prefixedDsn = 'https://abc@glitch.example/sentry/7';
    process.env.PUBLIC_SENTRY_DSN = prefixedDsn;
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    );

    await post(makeRequest(buildEnvelope(prefixedDsn)));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://glitch.example/sentry/api/7/envelope/');
  });
});

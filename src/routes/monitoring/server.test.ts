import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { deflateSync, gzipSync, unzipSync } from 'node:zlib';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { POST } from './+server';

const ORIGINAL_DSN = process.env.PUBLIC_SENTRY_DSN;

afterEach(() => {
  if (ORIGINAL_DSN === undefined) delete process.env.PUBLIC_SENTRY_DSN;
  else process.env.PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
  _clearAllRateLimits();
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

function post(request: Request, clientAddress = '198.51.100.7'): Promise<Response> {
  return POST({ request, getClientAddress: () => clientAddress } as unknown as Parameters<
    typeof POST
  >[0]);
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

describe('POST /monitoring — throttling', () => {
  it('answers 429 with Retry-After once one address exceeds 240 envelopes a minute', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(null, { status: 200 })
    );
    for (let i = 0; i < 240; i++) {
      expect((await post(makeRequest(buildEnvelope(CONFIGURED_DSN)))).status).toBe(200);
    }

    const throttled = await post(makeRequest(buildEnvelope(CONFIGURED_DSN)));

    expect(throttled.status).toBe(429);
    expect(Number(throttled.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledTimes(240);
    // Other clients keep their own budget.
    expect((await post(makeRequest(buildEnvelope(CONFIGURED_DSN)), '192.0.2.44')).status).toBe(200);
  });
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const RECORDED_FRAMES = [
  // rrweb Meta frame: Replay records location.href with every full snapshot.
  {
    type: 4,
    data: { href: 'https://diversif.app/child/18/log?date=2026-09-01#top', width: 1280 },
    timestamp: 1
  },
  { type: 5, data: { tag: 'breadcrumb', payload: { category: 'navigation' } }, timestamp: 2 }
];

// replay_event (JSON, no length header, as the SDK sends it) followed by a
// replay_recording whose payload is `{"segment_id":0}\n` + the encoded frames.
function replayEnvelope(recording: Uint8Array): Uint8Array {
  const payload = concat(encoder.encode('{"segment_id":0}\n'), recording);
  return concat(
    encoder.encode(`${JSON.stringify({ dsn: CONFIGURED_DSN })}\n`),
    encoder.encode('{"type":"replay_event"}\n{"type":"replay_event","replay_id":"r1"}\n'),
    encoder.encode(`${JSON.stringify({ type: 'replay_recording', length: payload.length })}\n`),
    payload
  );
}

/** Split the forwarded envelope into its replay_event line and recording item. */
function forwardedRecording(body: Uint8Array): { header: { length: number }; payload: Uint8Array } {
  const lines: number[] = [];
  for (let i = 0; i < body.length && lines.length < 4; i++) if (body[i] === 0x0a) lines.push(i);
  const header = JSON.parse(decoder.decode(body.subarray(lines[2] + 1, lines[3])));
  return { header, payload: body.subarray(lines[3] + 1) };
}

describe('POST /monitoring — replay recordings', () => {
  const encodings: Array<[string, (json: Uint8Array) => Uint8Array, (body: Uint8Array) => string]> =
    [
      ['gzip', (json) => gzipSync(json), (body) => decoder.decode(unzipSync(body))],
      ['zlib', (json) => deflateSync(json), (body) => decoder.decode(unzipSync(body))],
      ['uncompressed', (json) => json, (body) => decoder.decode(body)]
    ];

  for (const [name, encode, decode] of encodings) {
    it(`scrubs the page URL of rrweb Meta frames in ${name} recordings`, async () => {
      process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
      const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status: 200 })
      );
      const recording = encode(encoder.encode(JSON.stringify(RECORDED_FRAMES)));

      const response = await post(makeRequest(replayEnvelope(recording)));

      expect(response.status).toBe(200);
      const body = fetchSpy.mock.calls[0][1]?.body as Uint8Array;
      expect(decoder.decode(body.subarray(0, body.indexOf(0x0a)))).toBe(
        JSON.stringify({ dsn: CONFIGURED_DSN })
      );
      const { header, payload } = forwardedRecording(body);
      // The item length is rewritten to match the re-encoded payload.
      expect(header.length).toBe(payload.length);
      const segmentEnd = payload.indexOf(0x0a);
      expect(decoder.decode(payload.subarray(0, segmentEnd))).toBe('{"segment_id":0}');
      const frames = JSON.parse(decode(payload.subarray(segmentEnd + 1)));
      expect(frames[0].data).toEqual({ href: 'https://diversif.app/child/[id]/log', width: 1280 });
      expect(frames[1]).toEqual(RECORDED_FRAMES[1]);
    });
  }

  it('forwards an envelope without a replay recording byte for byte', async () => {
    process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    );
    // Last item has no length header and no trailing newline.
    const envelope = encoder.encode(
      `${JSON.stringify({ dsn: CONFIGURED_DSN })}\n{"type":"event"}\n{"message":"x"}`
    );

    await post(makeRequest(envelope));

    expect(fetchSpy.mock.calls[0][1]?.body).toEqual(envelope);
  });

  const malformed: Array<[string, Uint8Array]> = [
    [
      'an item header that is not an object',
      encoder.encode(`${JSON.stringify({ dsn: CONFIGURED_DSN })}\nnull\n{}`)
    ],
    [
      'an item longer than the body',
      encoder.encode(`${JSON.stringify({ dsn: CONFIGURED_DSN })}\n{"type":"x","length":99}\n{}`)
    ],
    // A negative length used to send offset backwards: the loop never ended.
    [
      'a negative item length',
      encoder.encode(`${JSON.stringify({ dsn: CONFIGURED_DSN })}\n{"type":"x","length":-27}\n{}`)
    ],
    [
      'a fractional item length',
      encoder.encode(`${JSON.stringify({ dsn: CONFIGURED_DSN })}\n{"type":"x","length":0.5}\n{}`)
    ],
    [
      'a recording without its segment line',
      encoder.encode(
        `${JSON.stringify({ dsn: CONFIGURED_DSN })}\n{"type":"replay_recording","length":2}\n[]`
      )
    ],
    ['a corrupt compressed recording', replayEnvelope(new Uint8Array([0x1f, 0x8b, 0x00, 0x01]))],
    // ~20 KB on the wire, a valid ~9.4 MB JSON array once inflated: only the
    // decompression cap can reject it.
    [
      'a recording that inflates past 8 MiB',
      replayEnvelope(gzipSync(encoder.encode(`[${'0,'.repeat(4_700_000)}0]`)))
    ]
  ];

  for (const [name, envelope] of malformed) {
    it(`rejects ${name} without forwarding it`, async () => {
      process.env.PUBLIC_SENTRY_DSN = CONFIGURED_DSN;
      const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('must not be called')
      );

      const response = await post(makeRequest(envelope));

      expect(response.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

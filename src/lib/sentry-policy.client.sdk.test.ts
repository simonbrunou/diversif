import { beforeEach, describe, expect, it } from 'bun:test';
import * as Sentry from '@sentry/sveltekit';
import * as m from '#lib/paraglide/messages.js';
import { recordingTransport } from '../test/sentry-recorder';
import { clientSentryOptions, handleClientError, replayOptions } from './sentry-policy';

// The real browser SDK, initialised with the policy's options: only the
// transport is swapped for a recorder, so every hook runs as in production.
// Vite inlines the release SHA in a build; without one the SDK drops sessions.
(globalThis as { __SENTRY_RELEASE__?: string }).__SENTRY_RELEASE__ = 'abc1234';
const recorder = recordingTransport();
Sentry.init({
  ...clientSentryOptions(
    {
      PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
      PUBLIC_SENTRY_ENVIRONMENT: '',
      PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '1',
      PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: '',
      PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: ''
    },
    []
  ),
  transport: recorder.transport
});

type Caught = Parameters<typeof handleClientError>[0];

/** A navigation error as SvelteKit hands it to the client hook. */
function navigationError(caught: Pick<Caught, 'kind' | 'error'>, routeId: string, params = {}) {
  return handleClientError({
    ...caught,
    event: { params, route: { id: routeId }, url: new URL(routeId, 'https://diversif.app') }
  } as Caught) as App.Error | undefined;
}

beforeEach(async () => {
  await recorder.reset();
});

describe('client handleError', () => {
  it('reports a bug under the route pattern, with the errorId the error page shows', async () => {
    // A failed __data.json load passes the page key, not the pattern.
    const body = navigationError(
      {
        kind: 'unknown',
        error: new SyntaxError('Unexpected token \'<\', "<!doctype "... is not valid JSON')
      },
      '/child/18/guide?x=1',
      { id: '18' }
    );

    expect(body).toEqual({
      message: 'Internal Error',
      errorId: expect.stringMatching(/^[0-9a-f]{8}$/)
    });
    const [event] = await recorder.sent('event');
    expect(event.tags).toMatchObject({
      errorId: body!.errorId,
      status: 500,
      route: '/child/[id]/guide'
    });
    expect(event.exception!.values![0]).toMatchObject({
      type: 'SyntaxError',
      value: 'Unexpected token \'…\', "…" is not valid JSON',
      mechanism: { type: 'auto.function.sveltekit.handle_error', handled: false }
    });
    expect(event.request!.url).not.toContain('18');
  });

  it('keeps the body of an error(...) thrown by route code, without reporting it', async () => {
    const body = navigationError(
      { kind: 'app', error: { message: 'Enfant introuvable' } },
      '/child/[id]',
      { id: '18' }
    );

    expect(body).toBeUndefined();
    expect(await recorder.sent('event')).toEqual([]);
  });

  it('does not report a 4xx: a client-side routing dead-end, not a bug', async () => {
    const body = navigationError(
      { kind: 'framework', error: { status: 404, message: 'Not Found' } },
      '/child/[id]/nope'
    );

    expect(body).toEqual({ message: 'Internal Error' });
    expect(await recorder.sent('event')).toEqual([]);
  });

  it('tells the parent to check their connection on a network failure, without reporting it', async () => {
    const body = navigationError(
      {
        kind: 'unknown',
        error: new TypeError(
          'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js'
        )
      },
      '/child/[id]/guide',
      { id: '18' }
    );

    expect(body).toEqual({ message: m.errorsNetwork() });
    expect(await recorder.sent('event')).toEqual([]);
  });

  it('treats a proxy error page answering an enhanced form as an unreachable server', async () => {
    // SvelteKit turns a non-JSON 5xx response to an enhanced form (Traefik's
    // 502 while Coolify swaps the container) into a framework error.
    const body = navigationError(
      { kind: 'framework', error: { status: 502, message: 'Bad Gateway' } },
      '/child/[id]/log'
    );

    expect(body).toEqual({ message: m.errorsNetwork() });
    expect(await recorder.sent('event')).toEqual([]);
  });
});

describe('client options', () => {
  const unset = {
    PUBLIC_SENTRY_DSN: '',
    PUBLIC_SENTRY_ENVIRONMENT: '',
    PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '',
    PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: '',
    PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: ''
  };

  it('sends envelopes to the same-origin tunnel, typed so SvelteKit hands it the body', () => {
    expect(recorder.opened).toEqual({
      url: '/monitoring',
      headers: { 'Content-Type': 'application/x-sentry-envelope' }
    });
  });

  it('tags events with the production environment unless one is configured', async () => {
    Sentry.captureMessage('environment probe');

    const [event] = await recorder.sent('event');
    expect(event.environment).toBe('production');
    expect(event.release).toBe('abc1234');
    expect(
      clientSentryOptions({ ...unset, PUBLIC_SENTRY_ENVIRONMENT: 'preview' }, []).environment
    ).toBe('preview');
  });

  it('samples 10% of traces and replays only around errors by default', () => {
    for (const raw of ['', '  ', 'abc', '1.5', '-0.1', 'Infinity']) {
      expect(
        clientSentryOptions(
          {
            ...unset,
            PUBLIC_SENTRY_TRACES_SAMPLE_RATE: raw,
            PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: raw,
            PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: raw
          },
          []
        )
      ).toMatchObject({
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1
      });
    }
  });

  it('takes any configured rate within [0, 1]', () => {
    expect(
      clientSentryOptions(
        {
          ...unset,
          PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '1',
          PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: '0.25',
          PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: '0'
        },
        []
      )
    ).toMatchObject({
      tracesSampleRate: 1,
      replaysSessionSampleRate: 0.25,
      replaysOnErrorSampleRate: 0
    });
  });

  it('opts out of every data category SDK v11 collects by default', () => {
    // v11 also ignores the removed sendDefaultPii, so the opt-out must be explicit.
    expect(clientSentryOptions(unset, []).dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false }
    });
  });
});

describe('client traces and breadcrumbs', () => {
  it('sends one transaction per trace, its name and spans scrubbed', async () => {
    Sentry.startSpan({ name: 'GET /child/18/log?/save', forceTransaction: true }, () => {
      Sentry.startSpan(
        { name: 'GET https://diversif.app/child/18/guide?x=1', op: 'http.client' },
        () => {}
      );
    });

    const transactions = await recorder.sent('transaction');
    const transaction = transactions.find((t) => t.transaction === 'GET /child/[id]/log');
    expect(transaction?.spans!.map((span) => span.description)).toEqual([
      'GET https://diversif.app/child/[id]/guide'
    ]);
    expect(JSON.stringify(transactions)).not.toContain('/child/18');
  });

  it('drops the resource span of every hashed JS chunk, whatever its initiator, and keeps the rest', async () => {
    // Shaped as the SDK builds resource spans: the op comes from the
    // browser's initiatorType, which differs across engines for the same
    // <link rel="modulepreload"> (Chromium says "other"), and the name is the
    // URL minus the page's origin.
    Sentry.startSpan({ name: 'GET /guide', forceTransaction: true }, () => {
      for (const [op, name, path] of [
        ['resource.other', '/_app/immutable/chunks/CLThMn91.js'],
        ['resource.script', '/_app/immutable/nodes/0.uSiPSxcP.js'],
        ['resource.link', '/_app/immutable/entry/start.EVIPfUgQ.js'],
        ['resource.link', '/_app/immutable/assets/0.DsRr6JJR.css'],
        ['resource.css', '/_app/immutable/assets/inter.B2xhLi2c.woff2'],
        ['resource.img', '/favicon.svg'],
        ['http.client', 'GET /child/18/__data.json', '/child/18/__data.json'],
        // Only resource spans go: a fetch of a chunk keeps its span.
        [
          'http.client',
          'GET /_app/immutable/chunks/CLThMn91.js',
          '/_app/immutable/chunks/CLThMn91.js'
        ]
      ]) {
        Sentry.startSpan(
          { op, name, attributes: { 'url.full': `https://diversif.app${path ?? name}` } },
          () => {}
        );
      }
    });

    const transactions = await recorder.sent('transaction');
    const transaction = transactions.find((t) => t.transaction === 'GET /guide');
    expect(transaction?.spans!.map((span) => span.description)).toEqual([
      '/_app/immutable/assets/0.DsRr6JJR.css',
      '/_app/immutable/assets/inter.B2xhLi2c.woff2',
      '/favicon.svg',
      'GET /child/[id]/__data.json',
      'GET /_app/immutable/chunks/CLThMn91.js'
    ]);
  });

  it('keeps click, input and console breadcrumbs out of the SDK buffer', () => {
    Sentry.addBreadcrumb({ category: 'navigation', message: 'kept' });
    for (const category of ['ui.click', 'ui.input', 'console']) {
      Sentry.addBreadcrumb({ category, message: `${category} probe` });
      expect(Sentry.getIsolationScope().getLastBreadcrumb()).toMatchObject({ message: 'kept' });
    }
  });

  it('never sends a click, an input or a console breadcrumb', async () => {
    Sentry.addBreadcrumb({ category: 'ui.click', message: 'button[aria-label="Retirer Léo"]' });
    Sentry.addBreadcrumb({ category: 'ui.input', message: 'input#email' });
    Sentry.addBreadcrumb({ category: 'console', message: '[diversif:error] {"userId":7}' });
    Sentry.addBreadcrumb({
      category: 'navigation',
      data: { from: '/child/18', to: '/child/18/log' }
    });
    Sentry.captureMessage('breadcrumb probe');

    const [event] = await recorder.sent('event');
    const crumbs = event.breadcrumbs!;
    const categories = crumbs.map((crumb) => crumb.category);
    expect(categories).not.toContain('ui.click');
    expect(categories).not.toContain('ui.input');
    expect(categories).not.toContain('console');
    expect(crumbs.at(-1)).toMatchObject({
      category: 'navigation',
      data: { from: '/child/[id]', to: '/child/[id]/log' }
    });
  });
});

describe('client payloads beforeSend never sees', () => {
  it('scrubs the page URL of a problem report and drops its contact fields', async () => {
    Sentry.captureFeedback({
      message: 'Écran blanc après le repas',
      url: 'https://diversif.app/child/18/guide?x=1',
      email: 'parent@example.com',
      name: 'Léa'
    });

    const [feedback] = await recorder.sent('feedback');
    expect(feedback.contexts!.feedback).toEqual({
      message: 'Écran blanc après le repas',
      url: 'https://diversif.app/child/[id]/guide'
    });
  });

  it('scrubs the pages a replay visited', async () => {
    Sentry.getClient()!.captureEvent({
      type: 'replay_event',
      urls: ['https://diversif.app/child/18/guide?x=1'],
      segment_names: ['GET /child/18/log']
    } as Parameters<NonNullable<ReturnType<typeof Sentry.getClient>>['captureEvent']>[0]);

    const [replay] = (await recorder.sent('event')).filter((e) => e.type === 'replay_event');
    expect(replay).toMatchObject({
      urls: ['https://diversif.app/child/[id]/guide'],
      segment_names: ['GET /child/[id]/log']
    });
  });

  it('leaves the user agent out of release-health sessions', async () => {
    Sentry.startSession();
    Sentry.captureSession();

    const sessions = await recorder.sent('session');
    expect(sessions.length).toBeGreaterThan(0);
    for (const session of sessions) expect(session.attrs).not.toHaveProperty('user_agent');
  });
});

describe('client Session Replay', () => {
  it('masks every text, input and medium, and keeps the session out of sessionStorage', () => {
    expect(replayOptions).toMatchObject({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      stickySession: false
    });
    expect(replayOptions.maskAttributes).toEqual(
      expect.arrayContaining(['aria-label', 'title', 'alt', 'value', 'datetime'])
    );
  });

  it('scrubs the frames Replay records around the masked snapshots', () => {
    const frame = (payload: object) => ({
      type: 5,
      timestamp: 0,
      data: { tag: 'breadcrumb', payload }
    });
    const scrub = (payload: object) =>
      replayOptions.beforeAddRecordingEvent?.(frame(payload) as never);

    expect(scrub({ category: 'console', message: '[diversif:error]' })).toBeNull();
    // A click keeps its replay node, minus the selector naming the child.
    expect(
      scrub({
        category: 'ui.click',
        message: 'button[aria-label="Retirer Léo"]',
        data: { node: { id: 7, tagName: 'button', attributes: { 'aria-label': 'Retirer Léo' } } }
      })
    ).toEqual(frame({ category: 'ui.click', data: { node: { id: 7, tagName: 'button' } } }));
  });
});

describe('client capture outside handleError', () => {
  // The SDK's global handler, where a rejection SvelteKit never catches lands
  // (a root chunk failing to load before hydration, DIVERSIF-D).
  function unhandledRejection(reason: unknown) {
    (globalThis.onunhandledrejection as (event: { reason: unknown }) => void)({ reason });
  }

  it('drops a network failure that never went through handleError', async () => {
    unhandledRejection(
      new TypeError(
        'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/0.uSiPSxcP.js'
      )
    );

    expect(await recorder.sent('event')).toEqual([]);
  });

  it('still sends any other unhandled error, its message scrubbed', async () => {
    unhandledRejection(new TypeError("Cannot read properties of undefined (reading '0')"));

    const [event] = await recorder.sent('event');
    expect(event.exception!.values![0]).toMatchObject({
      type: 'TypeError',
      value: "Cannot read properties of undefined (reading '…')",
      mechanism: { type: 'auto.browser.global_handlers.onunhandledrejection' }
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import * as Sentry from '@sentry/sveltekit';
import { error as kitError, redirect } from '@sveltejs/kit';
import { recordingTransport } from '../test/sentry-recorder';
import { handleServerError, serverSentryOptions, tagHandleChainError } from './sentry-policy';

// Tests resolve the browser build of the SDK, so the server options run on a
// BrowserClient here: the hooks they set (beforeSend*, ignoreTransactions) are
// applied by the SDK core both clients share. Of NodeClient's default
// integrations, the options rely on one: event filters, which apply
// ignoreTransactions.
const recorder = recordingTransport();
Sentry.init({
  ...serverSentryOptions({
    SENTRY_DSN: 'https://key@o1.ingest.sentry.io/1',
    SENTRY_TRACES_SAMPLE_RATE: '1'
  }),
  defaultIntegrations: [Sentry.eventFiltersIntegration()],
  transport: recorder.transport
});

type Caught = Parameters<typeof handleServerError>[0];

/** A request event as SvelteKit hands it to the server hook. */
function requestEvent(pathname: string, routeId: string | null, userId: number | null = 7) {
  const url = new URL(pathname, 'https://diversif.app');
  return {
    request: new Request(url, { method: 'POST' }),
    url,
    route: { id: routeId },
    locals: { user: userId ? { id: userId } : null }
  } as unknown as Caught['event'];
}

let stderr: ReturnType<typeof spyOn<Console, 'error'>>;

beforeEach(async () => {
  await recorder.reset();
  stderr = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  stderr.mockRestore();
  // sentryHandle forks an isolation scope per request; the browser SDK keeps
  // one for the whole page, so undo what the test's request left on it.
  Sentry.getIsolationScope()
    .setUser(null)
    .setTags({ errorId: undefined, status: undefined, method: undefined, route: undefined });
});

/** The JSON payload of the `[diversif:error]` stderr line. */
function stderrLine() {
  expect(stderr).toHaveBeenCalledTimes(1);
  expect(stderr.mock.calls[0][0]).toBe('[diversif:error]');
  return JSON.parse(stderr.mock.calls[0][1] as string);
}

describe('server handleError', () => {
  it('reports a bug with its message redacted, the full text going to stderr under the same errorId', async () => {
    const error = new TypeError('No child 18 for parent@example.com');

    Sentry.setUser({ id: '7', email: 'parent@example.com' });
    const body = handleServerError({
      kind: 'unknown',
      error,
      event: requestEvent('/child/18/log/9', '/child/[id]/log/[entryId]')
    } as Caught);

    expect(body).toEqual({
      message: 'Internal Error',
      errorId: expect.stringMatching(/^[0-9a-f]{8}$/)
    });
    const [event] = await recorder.sent('event');
    expect(event.tags).toMatchObject({
      errorId: body!.errorId,
      status: 500,
      method: 'POST',
      route: '/child/[id]/log/[entryId]'
    });
    expect(event.exception!.values![0]).toMatchObject({
      type: 'TypeError',
      value: '[redacted: see errorId in stderr]',
      mechanism: { type: 'auto.function.sveltekit.handle_error', handled: false }
    });
    expect(event.user).toBeUndefined();
    expect(stderrLine()).toEqual({
      id: body!.errorId,
      method: 'POST',
      path: '/child/[id]/log/[entryId]',
      userId: 7,
      status: 500,
      message: 'Internal Error',
      name: 'TypeError',
      msg: 'No child 18 for parent@example.com',
      stack: expect.stringContaining('TypeError')
    });
  });

  it('tags an unmatched route as null and scrubs the raw path for stderr', async () => {
    const body = handleServerError({
      kind: 'unknown',
      error: new Error('boom'),
      event: requestEvent('/child/18/guide', null, null)
    } as Caught);

    const [event] = await recorder.sent('event');
    expect(event.tags).toMatchObject({ errorId: body!.errorId, route: null });
    expect(stderrLine()).toMatchObject({ path: '/child/[id]/guide', userId: null });
  });

  it('reports a thrown non-Error without crashing', async () => {
    const body = handleServerError({
      kind: 'unknown',
      error: null,
      event: requestEvent('/', '/')
    } as Caught);

    expect(body).toEqual({
      message: 'Internal Error',
      errorId: expect.stringMatching(/^[0-9a-f]{8}$/)
    });
    expect(await recorder.sent('event')).toHaveLength(1);
    const line = stderrLine();
    expect(line.name).toBeUndefined();
    expect(line.msg).toBeUndefined();
  });

  it.each([
    ['framework', { status: 404, message: 'Not Found' }],
    ['validation', { status: 400, message: 'Bad Request' }]
  ] as const)(
    'skips the event and the stderr line for a %s 4xx, still giving the error page an errorId',
    async (kind, error) => {
      const body = handleServerError({
        kind,
        error,
        event: requestEvent('/wp-admin', null)
      } as Caught);

      expect(body).toEqual({
        message: 'Internal Error',
        errorId: expect.stringMatching(/^[0-9a-f]{8}$/)
      });
      expect(await recorder.sent('event')).toEqual([]);
      expect(stderr).not.toHaveBeenCalled();
    }
  );

  it.each([404, 503])(
    'leaves the body of an error(%i, ...) thrown by route code untouched, unreported',
    async (status) => {
      const body = handleServerError({
        kind: 'app',
        error: { message: 'Enfant introuvable', status },
        event: requestEvent('/child/18', '/child/[id]')
      } as Caught);

      expect(body).toBeUndefined();
      expect(await recorder.sent('event')).toEqual([]);
      expect(stderr).not.toHaveBeenCalled();
    }
  );
});

describe('server options', () => {
  it('sends straight to Sentry: the tunnel only relays browser envelopes', () => {
    expect(recorder.opened.url).toStartWith('https://o1.ingest.sentry.io/api/1/envelope/');
  });

  it('drops the transactions of tunnel relays and unmatched requests, scrubs the rest', async () => {
    for (const name of ['POST /monitoring', 'sveltekit.handle.root', 'GET /child/18/log']) {
      Sentry.startSpan({ name, forceTransaction: true }, () => {
        Sentry.startSpan({ name: 'SELECT FROM children WHERE id = 18', op: 'db' }, () => {});
      });
    }

    const transactions = await recorder.sent('transaction');
    expect(transactions.map((t) => t.transaction)).toEqual(['GET /child/[id]/log']);
    expect(JSON.stringify(transactions)).not.toContain('/child/18');
  });

  it('drops client attributes from logs and scrubs their URLs', async () => {
    Sentry.logger.info('Cleanup completed', {
      'user.email': 'parent@example.com',
      'http.request.header.cf_connecting_ip': '203.0.113.7',
      'url.path': '/child/18',
      expiredSessions: 3
    });

    const [log] = await recorder.sent('log');
    const attributes = log.items[0].attributes;
    expect(attributes).not.toHaveProperty('user.email');
    expect(attributes).not.toHaveProperty('http.request.header.cf_connecting_ip');
    expect(attributes['url.path'].value).toBe('/child/[id]');
    expect(attributes.expiredSessions.value).toBe(3);
  });

  it('keeps console breadcrumbs, such as the stderr line, out of the SDK buffer', () => {
    Sentry.addBreadcrumb({ category: 'http', message: 'kept' });
    Sentry.addBreadcrumb({ category: 'console', message: '[diversif:error] {"userId":7}' });

    expect(Sentry.getIsolationScope().getLastBreadcrumb()).toMatchObject({ message: 'kept' });
  });

  it('defaults to the production environment and 10% of traces, collecting no client data', () => {
    const options = serverSentryOptions({ SENTRY_TRACES_SAMPLE_RATE: 'abc' });

    expect(options).toMatchObject({
      dsn: '',
      environment: 'production',
      tracesSampleRate: 0.1,
      dataCollection: { userInfo: false, cookies: false, httpBodies: [] }
    });
    expect(serverSentryOptions({ SENTRY_ENVIRONMENT: 'preview' }).environment).toBe('preview');
  });
});

describe('an error escaping the handle chain', () => {
  function thrownBy(fn: () => never): unknown {
    try {
      fn();
    } catch (thrown) {
      return thrown;
    }
  }

  it('reaches Sentry once, under the errorId the error page then shows', async () => {
    const error = new Error('database is locked');
    const event = requestEvent('/child/18', null);

    tagHandleChainError(error, event);
    // sentryHandle captures the error on its way out of the handle chain,
    // before SvelteKit calls handleError, whose own capture the SDK drops.
    Sentry.captureException(error, {
      mechanism: { type: 'auto.function.sveltekit.handle', handled: false }
    });
    const body = handleServerError({ kind: 'unknown', error, event } as Caught);

    const events = await recorder.sent('event');
    expect(events).toHaveLength(1);
    expect(events[0].tags).toEqual({
      errorId: body!.errorId,
      status: 500,
      method: 'POST',
      route: null
    });
    expect(stderrLine().id).toBe(body!.errorId);
  });

  it('leaves a redirect or an error(...) thrown in the handle chain untagged', async () => {
    for (const thrown of [thrownBy(() => redirect(303, '/login')), thrownBy(() => kitError(404))]) {
      tagHandleChainError(thrown, requestEvent('/child/18', null));
      Sentry.captureMessage('after the handle chain');
    }

    const events = await recorder.sent('event');
    expect(events).toHaveLength(2);
    for (const event of events) expect(event.tags ?? {}).not.toHaveProperty('errorId');
  });
});

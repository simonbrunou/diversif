import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { init } from '@sentry/sveltekit';
import * as m from '#lib/paraglide/messages.js';

const captureExceptionMock = mock();
const initMock = mock();

// hooks.client.ts calls Sentry.init at import, so the stand-ins must be
// registered before it loads; a static import would be hoisted above
// mock.module, hence the dynamic import below. No DSN: Replay stays off.
mock.module('@sentry/sveltekit', () => ({
  init: initMock,
  browserTracingIntegration: mock(() => ({})),
  withStaticSpan: <T>(callback: T) => callback,
  captureException: captureExceptionMock
}));
mock.module('$app/env/public', () => ({
  PUBLIC_SENTRY_DSN: '',
  PUBLIC_SENTRY_ENVIRONMENT: '',
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '',
  PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: '',
  PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: ''
}));

const { handleError } = await import('./hooks.client');

function clientError(error: unknown, routeId: string, params: Record<string, string>) {
  return handleError({
    kind: 'unknown',
    error,
    event: { params, route: { id: routeId }, url: new URL(routeId, 'https://diversif.app') }
  } as unknown as Parameters<typeof handleError>[0]) as App.Error;
}

describe('client handleError', () => {
  beforeEach(() => captureExceptionMock.mockClear());

  it('tells the parent to check their connection on a network failure, without reporting it', () => {
    const result = clientError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js'
      ),
      '/child/[id]/guide',
      { id: '18' }
    );

    expect(result).toEqual({ message: m.errorsNetwork() });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('treats a proxy error page answering an enhanced form as an unreachable server', () => {
    // SvelteKit turns a non-JSON 5xx response to an enhanced form (Traefik's
    // 502 while Coolify swaps the container) into a framework error.
    const result = handleError({
      kind: 'framework',
      error: { status: 502, message: 'Bad Gateway' },
      event: {
        params: {},
        route: { id: '/child/[id]/log' },
        url: new URL('https://diversif.app/child/18/log')
      }
    } as unknown as Parameters<typeof handleError>[0]);

    expect(result).toEqual({ message: m.errorsNetwork() });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('reports any other error under the route pattern, with the errorId the error page shows', () => {
    const error = new SyntaxError('Unexpected token');
    // A failed __data.json load passes the page key, not the pattern.
    const result = clientError(error, '/child/18/guide?x=1', { id: '18' });

    expect(result.errorId).toMatch(/^[0-9a-f]{8}$/);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [captured, hint] = captureExceptionMock.mock.calls[0];
    expect(captured).toBe(error);
    expect(hint.captureContext.tags).toEqual({
      errorId: result.errorId,
      status: 500,
      route: '/child/[id]/guide'
    });
  });
});

describe('client beforeSend', () => {
  const options = initMock.mock.calls[0]?.[0] as Parameters<typeof init>[0] | undefined;

  // The SDK's global onunhandledrejection handler passes the rejection reason
  // as originalException (DIVERSIF-D).
  function rejected(reason: TypeError) {
    return options?.beforeSend?.(
      { exception: { values: [{ type: reason.name, value: reason.message }] } },
      { originalException: reason }
    );
  }

  it('is passed to Sentry.init', () => {
    expect(options?.beforeSend).toBeFunction();
  });

  it('drops a network failure that never went through handleError', () => {
    expect(
      rejected(
        new TypeError(
          'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/0.uSiPSxcP.js'
        )
      )
    ).toBeNull();
  });

  it('still sends any other unhandled error, scrubbed', () => {
    expect(rejected(new TypeError("Cannot read properties of undefined (reading '0')"))).toEqual({
      exception: {
        values: [{ type: 'TypeError', value: "Cannot read properties of undefined (reading '…')" }]
      }
    });
  });
});

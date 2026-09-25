import { beforeEach, describe, expect, it, mock } from 'bun:test';
import * as m from '$lib/paraglide/messages';

const captureExceptionMock = mock();

// hooks.client.ts calls Sentry.init at import, so the stand-ins must be
// registered before it loads; a static import would be hoisted above
// mock.module, hence the dynamic import below. No DSN: Replay stays off.
mock.module('@sentry/sveltekit', () => ({
  init: mock(),
  browserTracingIntegration: mock(() => ({})),
  captureException: captureExceptionMock
}));
mock.module('$env/dynamic/public', () => ({ env: {} }));

const { handleError } = await import('./hooks.client');

function clientError(error: unknown, routeId: string, params: Record<string, string>) {
  return handleError({
    error,
    status: 500,
    message: 'Internal Error',
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

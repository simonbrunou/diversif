import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from './test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

const { captureExceptionMock, initMock } = {
  captureExceptionMock: mock(),
  initMock: mock()
};

mock.module('@sentry/sveltekit', () => ({
  init: initMock,
  captureException: captureExceptionMock
}));

// The real paraglideMiddleware runs in these tests (no mock): it resolves
// the locale from the request URL and wraps appHandle in an
// AsyncLocalStorage scope, so the tests below exercise the actual 2.x
// per-request locale isolation — see the concurrency regression test.

import { handle, handleError, warnIfAddressHeaderMissing } from './hooks.server';
import * as m from '$lib/paraglide/messages';
import { createSession, SESSION_COOKIE } from '$lib/server/auth';
import { users, memberships, children, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

type CookieOpts = {
  path?: string;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  maxAge?: number;
};

function makeEvent(token: string | null, pathname = '/', themeCookie: string | null = null) {
  const set = mock((_name: string, _value: string, _opts: CookieOpts) => {});
  const del = mock((_name: string, _opts: CookieOpts) => {});
  const cookies = {
    get: mock((name: string) =>
      name === SESSION_COOKIE ? token : name === 'theme' ? themeCookie : null
    ),
    set,
    delete: del
  };
  const url = new URL(`http://localhost${pathname}`);
  const event = {
    cookies,
    url,
    // A real Request: paraglideMiddleware reads request.headers and clones
    // the request with a de-localized URL before invoking the app handle.
    request: new Request(url),
    locals: {} as App.Locals
  };
  return { event, set, del, cookies };
}

async function seedUser() {
  return (
    await testDb
      .insert(users)
      .values({
        email: 'a@example.com',
        passwordHash: 'placeholder-hash',
        displayName: 'A',
        createdAt: new Date()
      })
      .returning()
  )[0];
}

beforeEach(async () => {
  await resetTestDb();
});

describe('handle', () => {
  it('clears locals when no token', async () => {
    const { event } = makeEvent(null);
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.user).toBeNull();
    expect(event.locals.sessionId).toBeNull();
    expect(event.locals.memberships).toEqual([]);
    expect(resolve).toHaveBeenCalled();
  });

  it('clears stale token and deletes the cookie', async () => {
    const { event, del } = makeEvent('garbage-token');
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.user).toBeNull();
    expect(del).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });

  it('populates locals on a valid session', async () => {
    const user = await seedUser();
    const child = (
      await testDb
        .insert(children)
        .values({
          name: 'Bébé',
          birthDate: '2024-01-01',
          createdBy: user.id,
          createdAt: new Date()
        })
        .returning()
    )[0];
    await testDb
      .insert(memberships)
      .values({ userId: user.id, childId: child.id, role: 'owner', createdAt: new Date() });
    const { token, session } = await createSession(user.id);

    const { event } = makeEvent(token);
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(event.locals.user?.id).toBe(user.id);
    // locals.sessionId carries the STORED id (sha256 of the cookie token),
    // never the raw bearer token.
    expect(event.locals.sessionId).toBe(session.id);
    expect(event.locals.sessionId).not.toBe(token);
    expect(event.locals.memberships.length).toBe(1);
  });

  it('renews the cookie when session is close to expiry', async () => {
    const user = await seedUser();
    const { token, session } = await createSession(user.id);
    // Force expiry into the renewal window.
    await testDb
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(sessions.id, session.id));

    const { event, set } = makeEvent(token);
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(set).toHaveBeenCalled();
    const args = set.mock.calls[0];
    expect(args[0]).toBe(SESSION_COOKIE);
    // The renewed cookie must re-issue the RAW token — setting the stored
    // hash would log the user out on their next request.
    expect(args[1]).toBe(token);
    expect(args[2].path).toBe('/');
    expect(args[2].httpOnly).toBe(true);
  });

  it('emits X-Robots-Tag noindex for authenticated responses', async () => {
    const user = await seedUser();
    const { token } = await createSession(user.id);
    const { event } = makeEvent(token);
    const resolve = mock(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('emits X-Robots-Tag noindex on the /account area for anonymous requests', async () => {
    const { event } = makeEvent(null, '/account/deleted');
    const resolve = mock(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not set X-Robots-Tag for anonymous public pages', async () => {
    const { event } = makeEvent(null, '/');
    const resolve = mock(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('sets Cache-Control: no-store for authenticated responses', async () => {
    const user = await seedUser();
    const { token } = await createSession(user.id);
    const { event } = makeEvent(token, '/child/1');
    const resolve = mock(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not set Cache-Control for anonymous public pages', async () => {
    const { event } = makeEvent(null, '/');
    const resolve = mock(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('Cache-Control')).toBeNull();
  });

  it('marks the cookie secure in production', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const user = await seedUser();
      const { token, session } = await createSession(user.id);
      await testDb
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
        .where(eq(sessions.id, session.id));
      const { event, set } = makeEvent(token);
      const resolve = mock(async () => new Response('ok'));
      await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
      expect(set.mock.calls[0][2].secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('sets locale to fr for paths without /en/ prefix', async () => {
    const { event } = makeEvent(null, '/mentions-legales');
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.locale).toBe('fr');
  });

  it('sets locale to en for /en/ prefixed paths', async () => {
    const { event } = makeEvent(null, '/en/mentions-legales');
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.locale).toBe('en');
  });

  it('sets locale to en for the bare /en path', async () => {
    const { event } = makeEvent(null, '/en');
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.locale).toBe('en');
  });

  it('de-localizes event.request to match the rerouted event.url', async () => {
    const { event } = makeEvent(null, '/en/mentions-legales');
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(new URL(event.request.url).pathname).toBe('/mentions-legales');
  });

  it('isolates concurrent requests with different locales (no SSR cross-contamination)', async () => {
    // Regression for the 1.x setLanguageTag race (audit item 9): a module
    // global meant a concurrent FR request could flip an in-flight EN
    // render to French mid-stream. paraglideMiddleware's AsyncLocalStorage
    // scope must keep each request's m.X() calls on its own locale even
    // when the renders interleave across awaited ticks.
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const renderWith = async (pathname: string) => {
      const { event } = makeEvent(null, pathname);
      const resolve = mock(async () => {
        const before = m.chromeBack();
        // Yield the event loop so the other request's middleware runs (and
        // would have clobbered a module-global locale) before we read again.
        await tick();
        await tick();
        return new Response(`${before}|${m.chromeBack()}`);
      });
      const response = await handle({
        event,
        resolve
      } as unknown as Parameters<typeof handle>[0]);
      return response.text();
    };
    const [en, fr] = await Promise.all([renderWith('/en/mentions-legales'), renderWith('/')]);
    expect(en).toBe('Back|Back');
    expect(fr).toBe('Retour|Retour');
  });

  it('substitutes %paraglide.lang% in the rendered HTML', async () => {
    const { event } = makeEvent(null, '/en/mentions-legales');
    // SvelteKit can split the response across chunks; the <html lang>
    // placeholder lives in the very first chunk that gets streamed. Asserting
    // both done=false and done=true chunks get the substitution prevents a
    // regression where gating on `done` leaks `%paraglide.lang%` to the wire.
    const resolve = mock(
      async (
        _event,
        opts: { transformPageChunk: (c: { html: string; done: boolean }) => string }
      ) => {
        const final = opts.transformPageChunk({
          html: '<body>x</body></html>',
          done: true
        });
        const partial = opts.transformPageChunk({
          html: '<html lang="%paraglide.lang%">',
          done: false
        });
        return new Response(`${partial}${final}`);
      }
    );
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    const body = await response.text();
    expect(body).toContain('<html lang="en">');
    expect(body).not.toContain('%paraglide.lang%');
  });

  it('adds class="dark" to <html> when the theme cookie is dark', async () => {
    const { event } = makeEvent(null, '/', 'dark');
    const resolve = mock(
      async (
        _event,
        opts: { transformPageChunk: (c: { html: string; done: boolean }) => string }
      ) =>
        new Response(
          opts.transformPageChunk({ html: '<html lang="%paraglide.lang%">', done: false })
        )
    );
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(await response.text()).toContain('<html class="dark" lang="fr">');
  });

  it.each(['light', 'system', null] as const)(
    'does not add class="dark" when the theme cookie is %p',
    async (theme) => {
      const { event } = makeEvent(null, '/', theme);
      const resolve = mock(
        async (
          _event,
          opts: { transformPageChunk: (c: { html: string; done: boolean }) => string }
        ) =>
          new Response(
            opts.transformPageChunk({ html: '<html lang="%paraglide.lang%">', done: false })
          )
      );
      const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
      expect(await response.text()).toBe('<html lang="fr">');
    }
  );
});

describe('warnIfAddressHeaderMissing', () => {
  it('warns when PROTOCOL_HEADER is set without ADDRESS_HEADER', () => {
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const warned = warnIfAddressHeaderMissing({ PROTOCOL_HEADER: 'x-forwarded-proto' });
      expect(warned).toBe(true);
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toContain('ADDRESS_HEADER');
      expect(spy.mock.calls[0][0]).toContain('DEPLOY.md');
    } finally {
      spy.mockRestore();
    }
  });

  it('stays silent when both headers are configured', () => {
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(
        warnIfAddressHeaderMissing({
          PROTOCOL_HEADER: 'x-forwarded-proto',
          ADDRESS_HEADER: 'cf-connecting-ip'
        })
      ).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('stays silent when neither header is set (no proxy: socket address is correct)', () => {
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(warnIfAddressHeaderMissing({})).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('handleError', () => {
  function makeErrorEvent(
    pathname = '/child/2/guide',
    method = 'GET',
    userId: number | null = null
  ) {
    return {
      request: { method } as Request,
      url: new URL(`http://localhost${pathname}`),
      locals: { user: userId ? { id: userId } : null } as unknown as App.Locals
    };
  }

  it('logs a structured stderr line and returns a generic message + errorId', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const err = new TypeError('boom');
      const result = handleError({
        error: err,
        event: makeErrorEvent('/child/2/guide', 'GET', 42),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);

      expect(result?.message).toBe('Internal Error');
      expect(result?.errorId).toMatch(/^[0-9a-f]{8}$/);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toBe('[diversif:error]');
      const payload = JSON.parse(spy.mock.calls[0][1] as string);
      expect(payload.id).toBe(result?.errorId);
      // Path is scrubbed: numeric IDs become [id] so child/food identifiers
      // don't leak to the deployment platform's log aggregator.
      expect(payload.path).toBe('/child/[id]/guide');
      expect(payload.method).toBe('GET');
      expect(payload.userId).toBe(42);
      expect(payload.status).toBe(500);
      expect(payload.name).toBe('TypeError');
      expect(payload.msg).toBe('boom');
      expect(payload.stack).toContain('TypeError');
    } finally {
      spy.mockRestore();
    }
  });

  it('prefers event.route.id over the raw URL when scrubbing the path', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const event = {
        request: { method: 'GET' } as Request,
        url: new URL('http://localhost/child/2/log/7'),
        route: { id: '/child/[id]/log/[entryId]' },
        locals: { user: null } as unknown as App.Locals
      };
      handleError({
        error: new Error('boom'),
        event,
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      const payload = JSON.parse(spy.mock.calls[0][1] as string);
      // When route.id is set, it's the canonical scrubbed form : no need to
      // run the segment heuristics over the raw pathname.
      expect(payload.path).toBe('/child/[id]/log/[entryId]');
    } finally {
      spy.mockRestore();
    }
  });

  it('records userId as null when there is no authenticated user', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: makeErrorEvent('/login', 'POST', null),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      const payload = JSON.parse(spy.mock.calls[0][1] as string);
      expect(payload.userId).toBeNull();
      expect(payload.method).toBe('POST');
    } finally {
      spy.mockRestore();
    }
  });

  it('handles non-Error-shaped throws without crashing', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = handleError({
        error: null,
        event: makeErrorEvent(),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      expect(result?.message).toBe('Internal Error');
      expect(result?.errorId).toMatch(/^[0-9a-f]{8}$/);
      const payload = JSON.parse(spy.mock.calls[0][1] as string);
      expect(payload.name).toBeUndefined();
      expect(payload.msg).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('handleError → Sentry', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  function makeSentryErrorEvent(pathname = '/child/42/log/9', method = 'POST') {
    return {
      request: { method } as Request,
      url: new URL(`http://localhost${pathname}`),
      route: { id: '/child/[id]/log/[entryId]' },
      locals: { user: { id: 7 } } as unknown as App.Locals
    };
  }

  it('forwards the error to Sentry with errorId, status, method, route tags', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const err = new TypeError('boom');
      const result = handleError({
        error: err,
        event: makeSentryErrorEvent(),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);

      expect(captureExceptionMock).toHaveBeenCalledOnce();
      const [capturedErr, capturedCtx] = captureExceptionMock.mock.calls[0];
      expect(capturedErr).toBe(err);
      expect(capturedCtx.tags).toEqual({
        errorId: result?.errorId,
        status: 500,
        method: 'POST',
        route: '/child/[id]/log/[entryId]'
      });
      // No PII slipped in
      expect(capturedCtx.user).toBeUndefined();
      expect(capturedCtx.contexts).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('still emits the [diversif:error] stderr line', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: makeSentryErrorEvent(),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toBe('[diversif:error]');
    } finally {
      spy.mockRestore();
    }
  });

  it('routes default to null when SvelteKit did not match a route', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: { ...makeSentryErrorEvent(), route: { id: null } },
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      const ctx = captureExceptionMock.mock.calls[0][1];
      expect(ctx.tags.route).toBeNull();
      expect(ctx.tags.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it('skips Sentry capture and the stderr line for 4xx', () => {
    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = handleError({
        error: new Error('Not Found: /wp-admin'),
        event: { ...makeSentryErrorEvent(), route: { id: null } },
        status: 404,
        message: 'Not Found'
      } as unknown as Parameters<typeof handleError>[0]);
      // /+error.svelte still gets an errorId so support flows work, but no
      // Sentry event and no operator-noise log line.
      expect(result?.errorId).toMatch(/^[0-9a-f]{8}$/);
      expect(result?.message).toBe('Internal Error');
      expect(captureExceptionMock).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

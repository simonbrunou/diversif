import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from './test/db';
import * as m from '#lib/paraglide/messages.js';
import { copyCookies, makeRouteEvent } from './test/route';
import { users, memberships, children } from '#lib/server/db/schema.js';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const setIsolationTagsMock = mock();

// Tests resolve the browser build of @sentry/sveltekit (scripts/bun-test.ts
// runs with --conditions=browser), which has no sentryHandle. The stand-in
// must be registered before anything loads the SDK so it replaces the whole
// module; static imports of hooks.server / auth (which reach the SDK) would be
// hoisted above mock.module, hence the dynamic imports below.
mock.module('@sentry/sveltekit', () => ({
  captureException: mock(),
  getIsolationScope: () => ({ setTags: setIsolationTagsMock }),
  sentryHandle: () => mock()
}));

// The real paraglideMiddleware runs in these tests (no mock): it resolves
// the locale from the request URL and wraps appHandle in an
// AsyncLocalStorage scope, so the tests below exercise the actual 2.x
// per-request locale isolation — see the concurrency regression test.

// The exported `handle` is sequence(sentryHandle, localizedHandle); sequence()
// needs a live SvelteKit request store, so these tests drive the app's own
// handle directly.
const {
  localizedHandle: handle,
  handleError,
  warnIfAddressHeaderMissing
} = await import('./hooks.server');
const { startSession } = await import('#lib/server/session.js');

/** Cookies of a browser signed in as `userId`. */
async function signedIn(userId: number): Promise<Record<string, string>> {
  const device = makeRouteEvent();
  await startSession(device, userId);
  return copyCookies(device.cookies);
}

function makeEvent(
  session: Record<string, string> | null,
  pathname = '/',
  themeCookie: string | null = null
) {
  const { cookies } = makeRouteEvent({
    cookies: { ...session, ...(themeCookie ? { theme: themeCookie } : {}) }
  });
  const url = new URL(`http://localhost${pathname}`);
  const event = {
    cookies,
    url,
    // A real Request: paraglideMiddleware reads request.headers and clones
    // the request with a de-localized URL before invoking the app handle.
    request: new Request(url),
    locals: {} as App.Locals
  };
  return { event };
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
    expect(event.locals.memberships).toEqual([]);
    expect(resolve).toHaveBeenCalled();
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
    const { event } = makeEvent(await signedIn(user.id));
    const resolve = mock(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(event.locals.user?.id).toBe(user.id);
    expect(event.locals.memberships.length).toBe(1);
  });

  it('emits X-Robots-Tag noindex for authenticated responses', async () => {
    const user = await seedUser();
    const { event } = makeEvent(await signedIn(user.id));
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
    const { event } = makeEvent(await signedIn(user.id), '/child/1');
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

  it('sends Strict-Transport-Security in production only', async () => {
    const resolve = mock(async () => new Response('ok'));
    const dev = await handle({ event: makeEvent(null).event, resolve } as unknown as Parameters<
      typeof handle
    >[0]);
    expect(dev.headers.get('Strict-Transport-Security')).toBeNull();

    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prod = await handle({ event: makeEvent(null).event, resolve } as unknown as Parameters<
        typeof handle
      >[0]);
      expect(prod.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains'
      );
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

  it('gives a page that renders no <title> the app-wide one', async () => {
    const { event } = makeEvent(null, '/join/nope');
    const resolve = mock(
      async (
        _event,
        opts: { transformPageChunk: (c: { html: string; done: boolean }) => string }
      ) =>
        new Response(opts.transformPageChunk({ html: '<head></head><body>x</body>', done: true }))
    );
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(await response.text()).toBe(
      '<head><title>Diversif · Diversification alimentaire bébé</title></head><body>x</body>'
    );
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

  it('tags an error escaping the handle chain with the errorId the error page shows', async () => {
    // sentryHandle captures such errors before handleError runs, so the tag
    // must already be on the request scope when the error leaves the handle.
    setIsolationTagsMock.mockClear();
    const { event } = makeEvent(null, '/child/1');
    const failure = new Error('database is locked');
    const resolve = mock(async () => {
      throw failure;
    });

    const handled = handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    await expect(handled).rejects.toBe(failure);

    const spy = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = handleError({
        kind: 'unknown',
        error: failure,
        event: { ...event, route: { id: '/child/[id]' } }
      } as unknown as Parameters<typeof handleError>[0]);
      expect(setIsolationTagsMock).toHaveBeenCalledWith({
        errorId: result?.errorId,
        status: 500,
        method: 'GET',
        route: null
      });
    } finally {
      spy.mockRestore();
    }
  });
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

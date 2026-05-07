import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from './test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const { captureExceptionMock, initMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  initMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
  init: initMock,
  captureException: captureExceptionMock
}));

import { handle, handleError } from './hooks.server';
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

function makeEvent(token: string | null, pathname = '/') {
  const set = vi.fn((_name: string, _value: string, _opts: CookieOpts) => {});
  const del = vi.fn((_name: string, _opts: CookieOpts) => {});
  const cookies = {
    get: vi.fn((name: string) => (name === SESSION_COOKIE ? token : null)),
    set,
    delete: del
  };
  const event = {
    cookies,
    url: new URL(`http://localhost${pathname}`),
    locals: {} as App.Locals
  };
  return { event, set, del, cookies };
}

function seedUser() {
  return testDb
    .insert(users)
    .values({
      email: 'a@example.com',
      passwordHash: 'placeholder-hash',
      displayName: 'A',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

beforeEach(() => {
  resetTestDb();
});

describe('handle', () => {
  it('clears locals when no token', async () => {
    const { event } = makeEvent(null);
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.user).toBeNull();
    expect(event.locals.sessionId).toBeNull();
    expect(event.locals.memberships).toEqual([]);
    expect(resolve).toHaveBeenCalled();
  });

  it('clears stale token and deletes the cookie', async () => {
    const { event, del } = makeEvent('garbage-token');
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(event.locals.user).toBeNull();
    expect(del).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });

  it('populates locals on a valid session', async () => {
    const user = seedUser();
    const child = testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy: user.id,
        createdAt: new Date()
      })
      .returning()
      .all()[0];
    testDb
      .insert(memberships)
      .values({ userId: user.id, childId: child.id, role: 'owner', createdAt: new Date() })
      .run();
    const session = createSession(user.id);

    const { event } = makeEvent(session.id);
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(event.locals.user?.id).toBe(user.id);
    expect(event.locals.sessionId).toBe(session.id);
    expect(event.locals.memberships.length).toBe(1);
  });

  it('renews the cookie when session is close to expiry', async () => {
    const user = seedUser();
    const session = createSession(user.id);
    // Force expiry into the renewal window.
    testDb
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
      .where(eq(sessions.id, session.id))
      .run();

    const { event, set } = makeEvent(session.id);
    const resolve = vi.fn(async () => new Response('ok'));
    await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);

    expect(set).toHaveBeenCalled();
    const args = set.mock.calls[0];
    expect(args[0]).toBe(SESSION_COOKIE);
    expect(args[1]).toBe(session.id);
    expect(args[2].path).toBe('/');
    expect(args[2].httpOnly).toBe(true);
  });

  it('emits X-Robots-Tag noindex for authenticated responses', async () => {
    const user = seedUser();
    const session = createSession(user.id);
    const { event } = makeEvent(session.id);
    const resolve = vi.fn(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('emits X-Robots-Tag noindex on the /account area for anonymous requests', async () => {
    const { event } = makeEvent(null, '/account/deleted');
    const resolve = vi.fn(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('does not set X-Robots-Tag for anonymous public pages', async () => {
    const { event } = makeEvent(null, '/');
    const resolve = vi.fn(async () => new Response('ok'));
    const response = await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
    expect(response.headers.get('X-Robots-Tag')).toBeNull();
  });

  it('marks the cookie secure in production', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const user = seedUser();
      const session = createSession(user.id);
      testDb
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) })
        .where(eq(sessions.id, session.id))
        .run();
      const { event, set } = makeEvent(session.id);
      const resolve = vi.fn(async () => new Response('ok'));
      await handle({ event, resolve } as unknown as Parameters<typeof handle>[0]);
      expect(set.mock.calls[0][2].secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
      expect(payload.path).toBe('/child/2/guide');
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

  it('records userId as null when there is no authenticated user', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: { ...makeSentryErrorEvent(), route: { id: null } },
        status: 404,
        message: 'Not Found'
      } as unknown as Parameters<typeof handleError>[0]);
      const ctx = captureExceptionMock.mock.calls[0][1];
      expect(ctx.tags.route).toBeNull();
      expect(ctx.tags.status).toBe(404);
    } finally {
      spy.mockRestore();
    }
  });
});

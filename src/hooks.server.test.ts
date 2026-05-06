import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from './test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

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

describe('handleError (debug)', () => {
  it('logs the error and returns its name + message to the client', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const err = new TypeError('thing exploded');
      const result = handleError({
        error: err,
        event: { url: new URL('http://localhost/child/2/guide') },
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      expect(result?.message).toBe('TypeError: thing exploded');
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toBe('[diversif:handleError]');
      expect(spy.mock.calls[0][1]).toBe('/child/2/guide');
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to a generic name + message when the error is non-Error-shaped', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = handleError({
        error: null,
        event: { url: new URL('http://localhost/x') },
        status: 500,
        message: 'fallback'
      } as unknown as Parameters<typeof handleError>[0]);
      expect(result?.message).toBe('Error: fallback');
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back further when neither error nor message provide info', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const result = handleError({
        error: null,
        event: { url: new URL('http://localhost/x') },
        status: 500,
        message: undefined
      } as unknown as Parameters<typeof handleError>[0]);
      expect(result?.message).toBe('Error: unknown');
    } finally {
      spy.mockRestore();
    }
  });
});

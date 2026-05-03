import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from './test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { handle } from './hooks.server';
import { hashPassword, createSession, SESSION_COOKIE } from '$lib/server/auth';
import { users, memberships, children, sessions } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

type CookieOpts = {
  path?: string;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  maxAge?: number;
};

function makeEvent(token: string | null) {
  const set = vi.fn((_name: string, _value: string, _opts: CookieOpts) => {});
  const del = vi.fn((_name: string, _opts: CookieOpts) => {});
  const cookies = {
    get: vi.fn((name: string) => (name === SESSION_COOKIE ? token : null)),
    set,
    delete: del
  };
  const event = {
    cookies,
    locals: {} as App.Locals
  };
  return { event, set, del, cookies };
}

async function seedUser() {
  const passwordHash = await hashPassword('pw');
  return testDb
    .insert(users)
    .values({
      email: 'a@example.com',
      passwordHash,
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
    const user = await seedUser();
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
    const user = await seedUser();
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

  it('marks the cookie secure in production', async () => {
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const user = await seedUser();
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

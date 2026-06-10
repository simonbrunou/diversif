import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  SESSION_RENEW_THRESHOLD_MS,
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  hashPassword,
  verifyPassword,
  findUserByEmail,
  listMembershipsForUser,
  setSessionCookie
} from './auth';
import { users, memberships, children, sessions } from './db/schema';
import { eq } from 'drizzle-orm';

async function seedUser(opts: { email?: string; displayName?: string } = {}) {
  const email = (opts.email ?? 'parent@example.com').toLowerCase();
  const inserted = await testDb
    .insert(users)
    .values({
      email,
      passwordHash: 'placeholder-hash',
      displayName: opts.displayName ?? 'Parent',
      createdAt: new Date()
    })
    .returning();
  return inserted[0];
}

beforeEach(async () => {
  await resetTestDb();
});

describe('constants', () => {
  it('SESSION_COOKIE name', () => {
    expect(SESSION_COOKIE).toBe('session');
  });
  it('renew threshold is shorter than duration', () => {
    expect(SESSION_RENEW_THRESHOLD_MS).toBeLessThan(SESSION_DURATION_MS);
  });
});

describe('hashPassword / verifyPassword', () => {
  it('verifies a matching password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword(hash, 'correct horse')).toBe(true);
  });

  it('rejects a mismatching password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword(hash, 'battery staple')).toBe(false);
  });

  it('returns false on malformed hash without throwing', async () => {
    expect(await verifyPassword('not-a-valid-argon-hash', 'whatever')).toBe(false);
  });
});

describe('createSession / validateSession', () => {
  it('creates a session row for the user', async () => {
    const user = await seedUser();
    const session = await createSession(user.id);
    expect(session.userId).toBe(user.id);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const stored = (
      await testDb.select().from(sessions).where(eq(sessions.id, session.id)).limit(1)
    )[0];
    expect(stored?.id).toBe(session.id);
  });

  it('validateSession returns null for empty token', async () => {
    expect(await validateSession('')).toBeNull();
  });

  it('validateSession returns null for unknown token', async () => {
    expect(await validateSession('not-a-token')).toBeNull();
  });

  it('validateSession returns the user and session for a fresh token', async () => {
    const user = await seedUser();
    const session = await createSession(user.id);
    const result = await validateSession(session.id);
    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(user.id);
    expect(result!.user).not.toHaveProperty('passwordHash');
    expect(result!.session.id).toBe(session.id);
    expect(result!.renewed).toBe(false);
  });

  it('validateSession renews when within the renewal threshold and bumps last_login_at', async () => {
    const user = await seedUser();
    await testDb
      .update(users)
      .set({ lastLoginAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
      .where(eq(users.id, user.id));
    const session = await createSession(user.id);
    // Move expiry to 1 hour from now (well inside renewal window).
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    await testDb.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, session.id));

    const result = await validateSession(session.id);
    expect(result?.renewed).toBe(true);
    expect(result!.session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
    const fresh = (await testDb.select().from(users).where(eq(users.id, user.id)).limit(1))[0];
    expect(fresh!.lastLoginAt!.getTime()).toBeGreaterThan(Date.now() - 5_000);
  });

  it('validateSession returns null when expired', async () => {
    const user = await seedUser();
    const session = await createSession(user.id);
    await testDb
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.id));
    expect(await validateSession(session.id)).toBeNull();
  });
});

describe('invalidateSession', () => {
  it('removes the session row', async () => {
    const user = await seedUser();
    const session = await createSession(user.id);
    await invalidateSession(session.id);
    expect(await validateSession(session.id)).toBeNull();
  });

  it('does nothing for empty token', async () => {
    // bun:test's .resolves.not.toThrow() tries to call the resolved value
    // as a function. Assert the resolved value (void → undefined) directly.
    await expect(invalidateSession('')).resolves.toBeUndefined();
  });
});

describe('invalidateAllUserSessions', () => {
  it('removes every session for a user', async () => {
    const user = await seedUser();
    const a = await createSession(user.id);
    const b = await createSession(user.id);
    await invalidateAllUserSessions(user.id);
    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();
  });
});

describe('findUserByEmail', () => {
  it('finds a user by case-insensitive email', async () => {
    const user = await seedUser({ email: 'Parent@Example.com' });
    expect((await findUserByEmail('parent@example.com'))?.id).toBe(user.id);
    expect((await findUserByEmail('PARENT@EXAMPLE.COM'))?.id).toBe(user.id);
  });

  it('returns undefined for unknown email', async () => {
    expect(await findUserByEmail('nobody@example.com')).toBeUndefined();
  });
});

describe('listMembershipsForUser', () => {
  it('returns empty array for new user', async () => {
    const user = await seedUser();
    expect(await listMembershipsForUser(user.id)).toEqual([]);
  });

  it('returns memberships for the user only', async () => {
    const user = await seedUser({ email: 'a@example.com' });
    const other = await seedUser({ email: 'b@example.com' });

    const child = await testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy: user.id,
        createdAt: new Date()
      })
      .returning();

    await testDb.insert(memberships).values({
      userId: user.id,
      childId: child[0].id,
      role: 'owner',
      createdAt: new Date()
    });

    expect((await listMembershipsForUser(user.id)).length).toBe(1);
    expect(await listMembershipsForUser(other.id)).toEqual([]);
  });

  it('orders memberships by joined-at, not by child id', async () => {
    const user = await seedUser({ email: 'order@example.com' });
    const mkChild = (name: string) =>
      testDb
        .insert(children)
        .values({ name, birthDate: '2024-06-01', createdBy: user.id, createdAt: new Date() })
        .returning();
    const [coParented] = await mkChild('Aîné');
    const [own] = await mkChild('Cadet');

    // The user created their own child first, then joined an OLDER child
    // (smaller id) via invitation. kids[0] is the nav fallback target, so
    // join order must win over child id — otherwise the co-parented child
    // silently becomes the default log target.
    await testDb.insert(memberships).values({
      userId: user.id,
      childId: own.id,
      role: 'owner',
      createdAt: new Date('2026-01-01T00:00:00Z')
    });
    await testDb.insert(memberships).values({
      userId: user.id,
      childId: coParented.id,
      role: 'member',
      createdAt: new Date('2026-02-01T00:00:00Z')
    });

    const rows = await listMembershipsForUser(user.id);
    expect(rows.map((r) => r.childId)).toEqual([own.id, coParented.id]);
  });
});

describe('setSessionCookie', () => {
  it('calls cookies.set with the session cookie name and correct options', () => {
    const setCalls: [string, string, Record<string, unknown>][] = [];
    const mockCookies = {
      set: (name: string, value: string, opts: Record<string, unknown>) => {
        setCalls.push([name, value, opts]);
      }
    };

    // Cast to satisfy the Cookies type — only .set is exercised.
    setSessionCookie(mockCookies as Parameters<typeof setSessionCookie>[0], 'test-session-id');

    expect(setCalls).toHaveLength(1);
    const [name, value, opts] = setCalls[0];
    expect(name).toBe(SESSION_COOKIE);
    expect(value).toBe('test-session-id');
    expect(opts.path).toBe('/');
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(typeof opts.maxAge).toBe('number');
    expect(opts.maxAge as number).toBe(Math.floor(SESSION_DURATION_MS / 1000));
  });
});

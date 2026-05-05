import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

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
  listMembershipsForUser
} from './auth';
import { users, memberships, children, sessions } from './db/schema';
import { eq } from 'drizzle-orm';

function seedUser(opts: { email?: string; displayName?: string } = {}) {
  const email = (opts.email ?? 'parent@example.com').toLowerCase();
  const inserted = testDb
    .insert(users)
    .values({
      email,
      passwordHash: 'placeholder-hash',
      displayName: opts.displayName ?? 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all();
  return inserted[0];
}

beforeEach(() => {
  resetTestDb();
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
    const user = seedUser();
    const session = createSession(user.id);
    expect(session.userId).toBe(user.id);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const stored = testDb.select().from(sessions).where(eq(sessions.id, session.id)).get();
    expect(stored?.id).toBe(session.id);
  });

  it('validateSession returns null for empty token', () => {
    expect(validateSession('')).toBeNull();
  });

  it('validateSession returns null for unknown token', () => {
    expect(validateSession('not-a-token')).toBeNull();
  });

  it('validateSession returns the user and session for a fresh token', async () => {
    const user = seedUser();
    const session = createSession(user.id);
    const result = validateSession(session.id);
    expect(result).not.toBeNull();
    expect(result!.user.id).toBe(user.id);
    expect(result!.user).not.toHaveProperty('passwordHash');
    expect(result!.session.id).toBe(session.id);
    expect(result!.renewed).toBe(false);
  });

  it('validateSession renews when within the renewal threshold and bumps last_login_at', async () => {
    const user = seedUser();
    testDb
      .update(users)
      .set({ lastLoginAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
      .where(eq(users.id, user.id))
      .run();
    const session = createSession(user.id);
    // Move expiry to 1 hour from now (well inside renewal window).
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    testDb.update(sessions).set({ expiresAt: soon }).where(eq(sessions.id, session.id)).run();

    const result = validateSession(session.id);
    expect(result?.renewed).toBe(true);
    expect(result!.session.expiresAt.getTime()).toBeGreaterThan(soon.getTime());
    const fresh = testDb.select().from(users).where(eq(users.id, user.id)).get();
    expect(fresh!.lastLoginAt!.getTime()).toBeGreaterThan(Date.now() - 5_000);
  });

  it('validateSession returns null when expired', async () => {
    const user = seedUser();
    const session = createSession(user.id);
    testDb
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, session.id))
      .run();
    expect(validateSession(session.id)).toBeNull();
  });
});

describe('invalidateSession', () => {
  it('removes the session row', async () => {
    const user = seedUser();
    const session = createSession(user.id);
    invalidateSession(session.id);
    expect(validateSession(session.id)).toBeNull();
  });

  it('does nothing for empty token', () => {
    expect(() => invalidateSession('')).not.toThrow();
  });
});

describe('invalidateAllUserSessions', () => {
  it('removes every session for a user', async () => {
    const user = seedUser();
    const a = createSession(user.id);
    const b = createSession(user.id);
    invalidateAllUserSessions(user.id);
    expect(validateSession(a.id)).toBeNull();
    expect(validateSession(b.id)).toBeNull();
  });
});

describe('findUserByEmail', () => {
  it('finds a user by case-insensitive email', async () => {
    const user = seedUser({ email: 'Parent@Example.com' });
    expect(findUserByEmail('parent@example.com')?.id).toBe(user.id);
    expect(findUserByEmail('PARENT@EXAMPLE.COM')?.id).toBe(user.id);
  });

  it('returns undefined for unknown email', () => {
    expect(findUserByEmail('nobody@example.com')).toBeUndefined();
  });
});

describe('listMembershipsForUser', () => {
  it('returns empty array for new user', async () => {
    const user = seedUser();
    expect(listMembershipsForUser(user.id)).toEqual([]);
  });

  it('returns memberships for the user only', async () => {
    const user = seedUser({ email: 'a@example.com' });
    const other = seedUser({ email: 'b@example.com' });

    const child = testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy: user.id,
        createdAt: new Date()
      })
      .returning()
      .all();

    testDb
      .insert(memberships)
      .values({
        userId: user.id,
        childId: child[0].id,
        role: 'owner',
        createdAt: new Date()
      })
      .run();

    expect(listMembershipsForUser(user.id).length).toBe(1);
    expect(listMembershipsForUser(other.id)).toEqual([]);
  });
});

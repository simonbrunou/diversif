import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { runCleanup, startCleanupTimer, stopCleanupTimer } from './cleanup';
import { invitations, sessions, users, webauthnChallenges, children } from './db/schema';
import { _clearAllRateLimits, checkRateLimit } from './rate-limit';

beforeEach(() => {
  resetTestDb();
  _clearAllRateLimits();
});

afterEach(() => {
  stopCleanupTimer();
});

async function seedUserAndChild() {
  const u = testDb
    .insert(users)
    .values({
      email: 'a@b.c',
      passwordHash: 'h',
      displayName: 'A',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
  const c = testDb
    .insert(children)
    .values({ name: 'Bébé', birthDate: '2024-01-01', createdBy: u.id, createdAt: new Date() })
    .returning()
    .all()[0];
  return { u, c };
}

describe('runCleanup', () => {
  it('deletes expired sessions, invitations, and challenges only', async () => {
    const { u, c } = await seedUserAndChild();
    const past = new Date(Date.now() - 10_000);
    const future = new Date(Date.now() + 10_000);

    testDb.insert(sessions).values({ id: 'old', userId: u.id, expiresAt: past }).run();
    testDb.insert(sessions).values({ id: 'fresh', userId: u.id, expiresAt: future }).run();

    testDb
      .insert(invitations)
      .values({
        code: 'OLD',
        childId: c.id,
        createdBy: u.id,
        createdAt: past,
        expiresAt: past
      })
      .run();
    testDb
      .insert(invitations)
      .values({
        code: 'FRESH',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: future
      })
      .run();

    testDb
      .insert(webauthnChallenges)
      .values({ token: 'old', challenge: 'x', purpose: 'authentication', expiresAt: past })
      .run();
    testDb
      .insert(webauthnChallenges)
      .values({ token: 'fresh', challenge: 'y', purpose: 'authentication', expiresAt: future })
      .run();

    const result = runCleanup();
    expect(result).toEqual({
      expiredSessions: 1,
      expiredInvitations: 1,
      expiredChallenges: 1,
      evictedRateLimitBuckets: 0
    });
    expect(testDb.select().from(sessions).all()).toHaveLength(1);
    expect(testDb.select().from(invitations).all()).toHaveLength(1);
    expect(testDb.select().from(webauthnChallenges).all()).toHaveLength(1);
  });

  it('returns zeros when nothing has expired', () => {
    expect(runCleanup()).toEqual({
      expiredSessions: 0,
      expiredInvitations: 0,
      expiredChallenges: 0,
      evictedRateLimitBuckets: 0
    });
  });

  it('evicts stale rate-limit buckets older than the longest auth window', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      const opts = { name: 'test', limit: 5, windowMs: 60_000 };
      checkRateLimit(opts, 'oldClient');
      checkRateLimit(opts, 'recentClient');

      // Jump forward beyond the eviction cutoff (1h) but only touch one client.
      vi.setSystemTime(new Date('2024-01-01T01:30:00Z'));
      checkRateLimit(opts, 'recentClient');

      const result = runCleanup();
      expect(result.evictedRateLimitBuckets).toBe(1);
      // 'recentClient' carries one in-window hit at 01:30 (the 00:00 hit was
      // already trimmed when we touched it again), plus the assertion call
      // adds a second; remaining = 5 - 2 = 3. 'oldClient' was evicted, so a
      // fresh hit leaves 4 of 5.
      expect(checkRateLimit(opts, 'recentClient').remaining).toBe(3);
      expect(checkRateLimit(opts, 'oldClient').remaining).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('startCleanupTimer', () => {
  it('runs once on start and is idempotent', async () => {
    const { u } = await seedUserAndChild();
    const past = new Date(Date.now() - 1);
    testDb.insert(sessions).values({ id: 's1', userId: u.id, expiresAt: past }).run();

    startCleanupTimer();
    // Initial run is synchronous.
    expect(testDb.select().from(sessions).all()).toHaveLength(0);

    // Second call is a no-op.
    startCleanupTimer();
    stopCleanupTimer();
    // Stopping when there is no timer is also safe.
    stopCleanupTimer();
  });

  it('logs but does not throw when initial or scheduled runs fail', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let throwsLeft = 2;
    const originalDelete = testDb.delete;
    const deleteSpy = vi.spyOn(testDb, 'delete').mockImplementation((...args) => {
      if (throwsLeft > 0) {
        throwsLeft -= 1;
        throw new Error('boom');
      }
      return originalDelete.apply(testDb, args as Parameters<typeof originalDelete>);
    });

    vi.useFakeTimers();
    startCleanupTimer();
    expect(errSpy).toHaveBeenCalledWith('[cleanup] initial run failed:', expect.any(Error));

    vi.advanceTimersByTime(1000 * 60 * 60 * 6);
    expect(errSpy).toHaveBeenCalledWith('[cleanup] scheduled run failed:', expect.any(Error));

    stopCleanupTimer();
    vi.useRealTimers();
    deleteSpy.mockRestore();
    errSpy.mockRestore();
  });
});

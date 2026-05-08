import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../test/db';
import { idempotencyKeys, users } from './db/schema';
import {
  IdempotencyInFlight,
  IdempotencyScopeMismatch,
  pruneExpiredKeys,
  withIdempotencyKey
} from './idempotency';

const SCOPE = 'log:child:1';

async function seedUser(id = 1): Promise<void> {
  await testDb.insert(users).values({
    id,
    email: `u${id}@test.local`,
    displayName: `U${id}`,
    passwordHash: 'x',
    createdAt: new Date()
  });
}

describe('withIdempotencyKey', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedUser();
  });

  it('runs doWork on a fresh key, stores redirect, returns "fresh"', async () => {
    const doWork = vi.fn(() => ({ redirect: '/child/1?logged=1' }));
    const result = await testDb.transaction(async (tx) =>
      withIdempotencyKey(tx, { key: 'k1', userId: 1, scope: SCOPE }, doWork)
    );
    expect(doWork).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'fresh', redirect: '/child/1?logged=1' });

    const row = (
      await testDb.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'k1')).limit(1)
    )[0];
    expect(row?.redirect).toBe('/child/1?logged=1');
  });

  it('replays without calling doWork when key has a stored redirect', async () => {
    await testDb.transaction(async (tx) =>
      withIdempotencyKey(tx, { key: 'k2', userId: 1, scope: SCOPE }, () => ({
        redirect: '/child/1?logged=1&first=1'
      }))
    );

    const doWork = vi.fn(() => ({ redirect: 'should-not-run' }));
    const result = await testDb.transaction(async (tx) =>
      withIdempotencyKey(tx, { key: 'k2', userId: 1, scope: SCOPE }, doWork)
    );
    expect(doWork).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'replay', redirect: '/child/1?logged=1&first=1' });
  });

  it('throws IdempotencyInFlight when a row exists with null redirect', async () => {
    await testDb
      .insert(idempotencyKeys)
      .values({ key: 'k3', userId: 1, scope: SCOPE, redirect: null, createdAt: new Date() });

    const doWork = vi.fn();
    await expect(
      testDb.transaction(async (tx) =>
        withIdempotencyKey(tx, { key: 'k3', userId: 1, scope: SCOPE }, doWork)
      )
    ).rejects.toThrow(IdempotencyInFlight);
    expect(doWork).not.toHaveBeenCalled();
  });

  it('throws IdempotencyScopeMismatch when a row exists with a different scope', async () => {
    await testDb.insert(idempotencyKeys).values({
      key: 'k4',
      userId: 1,
      scope: 'log:child:99',
      redirect: '/child/99?logged=1',
      createdAt: new Date()
    });

    const doWork = vi.fn();
    await expect(
      testDb.transaction(async (tx) =>
        withIdempotencyKey(tx, { key: 'k4', userId: 1, scope: SCOPE }, doWork)
      )
    ).rejects.toThrow(IdempotencyScopeMismatch);
    expect(doWork).not.toHaveBeenCalled();
  });

  it('rolls back the inserted key row when doWork throws', async () => {
    const err = new Error('boom');
    await expect(
      testDb.transaction(async (tx) =>
        withIdempotencyKey(tx, { key: 'k5', userId: 1, scope: SCOPE }, () => {
          throw err;
        })
      )
    ).rejects.toThrow(err);

    const row = (
      await testDb.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'k5')).limit(1)
    )[0];
    expect(row).toBeUndefined();
  });
});

describe('pruneExpiredKeys', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedUser();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes only rows older than the threshold and returns the count', async () => {
    const now = new Date('2026-05-07T12:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    await testDb.insert(idempotencyKeys).values([
      {
        key: 'old1',
        userId: 1,
        scope: SCOPE,
        redirect: '/x',
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000)
      },
      {
        key: 'old2',
        userId: 1,
        scope: SCOPE,
        redirect: '/x',
        createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000)
      },
      {
        key: 'fresh',
        userId: 1,
        scope: SCOPE,
        redirect: '/x',
        createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
      }
    ]);

    const deleted = await testDb.transaction(async (tx) => pruneExpiredKeys(tx));
    expect(deleted).toBe(2);

    const remaining = await testDb.select().from(idempotencyKeys);
    expect(remaining.map((r) => r.key)).toEqual(['fresh']);
  });

  it('respects a custom threshold', async () => {
    const now = new Date('2026-05-07T12:00:00Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    await testDb.insert(idempotencyKeys).values({
      key: 'k',
      userId: 1,
      scope: SCOPE,
      redirect: '/x',
      createdAt: new Date(now.getTime() - 90 * 1000)
    });

    const deleted = await testDb.transaction(async (tx) => pruneExpiredKeys(tx, 60 * 1000));
    expect(deleted).toBe(1);
  });
});

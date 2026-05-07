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

function seedUser(id = 1): void {
  testDb
    .insert(users)
    .values({
      id,
      email: `u${id}@test.local`,
      displayName: `U${id}`,
      passwordHash: 'x',
      createdAt: new Date()
    })
    .run();
}

describe('withIdempotencyKey', () => {
  beforeEach(() => {
    resetTestDb();
    seedUser();
  });

  it('runs doWork on a fresh key, stores redirect, returns "fresh"', () => {
    const doWork = vi.fn(() => ({ redirect: '/child/1?logged=1' }));
    const result = testDb.transaction((tx) =>
      withIdempotencyKey(tx, { key: 'k1', userId: 1, scope: SCOPE }, doWork)
    );
    expect(doWork).toHaveBeenCalledOnce();
    expect(result).toEqual({ kind: 'fresh', redirect: '/child/1?logged=1' });

    const row = testDb.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'k1')).get();
    expect(row?.redirect).toBe('/child/1?logged=1');
  });

  it('replays without calling doWork when key has a stored redirect', () => {
    testDb.transaction((tx) =>
      withIdempotencyKey(tx, { key: 'k2', userId: 1, scope: SCOPE }, () => ({
        redirect: '/child/1?logged=1&first=1'
      }))
    );

    const doWork = vi.fn(() => ({ redirect: 'should-not-run' }));
    const result = testDb.transaction((tx) =>
      withIdempotencyKey(tx, { key: 'k2', userId: 1, scope: SCOPE }, doWork)
    );
    expect(doWork).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'replay', redirect: '/child/1?logged=1&first=1' });
  });

  it('throws IdempotencyInFlight when a row exists with null redirect', () => {
    testDb
      .insert(idempotencyKeys)
      .values({ key: 'k3', userId: 1, scope: SCOPE, redirect: null, createdAt: new Date() })
      .run();

    const doWork = vi.fn();
    expect(() =>
      testDb.transaction((tx) =>
        withIdempotencyKey(tx, { key: 'k3', userId: 1, scope: SCOPE }, doWork)
      )
    ).toThrow(IdempotencyInFlight);
    expect(doWork).not.toHaveBeenCalled();
  });

  it('throws IdempotencyScopeMismatch when a row exists with a different scope', () => {
    testDb
      .insert(idempotencyKeys)
      .values({
        key: 'k4',
        userId: 1,
        scope: 'log:child:99',
        redirect: '/child/99?logged=1',
        createdAt: new Date()
      })
      .run();

    const doWork = vi.fn();
    expect(() =>
      testDb.transaction((tx) =>
        withIdempotencyKey(tx, { key: 'k4', userId: 1, scope: SCOPE }, doWork)
      )
    ).toThrow(IdempotencyScopeMismatch);
    expect(doWork).not.toHaveBeenCalled();
  });

  it('rolls back the inserted key row when doWork throws', () => {
    const err = new Error('boom');
    expect(() =>
      testDb.transaction((tx) =>
        withIdempotencyKey(tx, { key: 'k5', userId: 1, scope: SCOPE }, () => {
          throw err;
        })
      )
    ).toThrow(err);

    const row = testDb.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, 'k5')).get();
    expect(row).toBeUndefined();
  });
});

describe('pruneExpiredKeys', () => {
  beforeEach(() => {
    resetTestDb();
    seedUser();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes only rows older than the threshold and returns the count', () => {
    const now = new Date('2026-05-07T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    testDb
      .insert(idempotencyKeys)
      .values([
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
      ])
      .run();

    const deleted = testDb.transaction((tx) => pruneExpiredKeys(tx));
    expect(deleted).toBe(2);

    const remaining = testDb.select().from(idempotencyKeys).all();
    expect(remaining.map((r) => r.key)).toEqual(['fresh']);
  });

  it('respects a custom threshold', () => {
    const now = new Date('2026-05-07T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    testDb
      .insert(idempotencyKeys)
      .values({
        key: 'k',
        userId: 1,
        scope: SCOPE,
        redirect: '/x',
        createdAt: new Date(now.getTime() - 90 * 1000)
      })
      .run();

    const deleted = testDb.transaction((tx) => pruneExpiredKeys(tx, 60 * 1000));
    expect(deleted).toBe(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test';
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
    const doWork = mock(() => ({ redirect: '/child/1?logged=1' }));
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

    const doWork = mock(() => ({ redirect: 'should-not-run' }));
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

    const doWork = mock();
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

    const doWork = mock();
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

  it('absorbs a concurrent INSERT race as IdempotencyInFlight, not a 500', async () => {
    // Simulate the race: another concurrent transaction wins the optimistic
    // INSERT before our savepoint runs. Our INSERT raises 23505; the savepoint
    // rolls back and we should detect the existing in-flight row and throw
    // IdempotencyInFlight (which the route turns into a 409, never a 500).
    //
    // Under pg-mem the original test nested an `await testDb.insert(...)` inside
    // `testDb.transaction(...)` to simulate the racing process. PGlite is
    // single-connection in-process WASM, so the nested insert deadlocks. We
    // pre-seed the racing row first, then drive withIdempotencyKey against the
    // testDb directly: the savepoint's INSERT raises 23505 (real Postgres
    // semantics under PGlite), the catch path queries the existing row and
    // throws IdempotencyInFlight.
    await testDb.insert(idempotencyKeys).values({
      key: 'race',
      userId: 1,
      scope: SCOPE,
      redirect: null,
      createdAt: new Date()
    });
    const doWork = mock(() => ({ redirect: '/should-not-run' }));
    await expect(
      withIdempotencyKey(testDb, { key: 'race', userId: 1, scope: SCOPE }, doWork)
    ).rejects.toThrow(IdempotencyInFlight);
    expect(doWork).not.toHaveBeenCalled();
  });

  it('rethrows non-PK errors from the savepoint INSERT', async () => {
    // Trigger a FK violation (23503) by passing a userId that doesn't exist.
    // The savepoint INSERT fails : isUniqueViolation rejects 23503, so
    // withIdempotencyKey re-throws instead of treating it as a race.
    const doWork = mock();
    await expect(
      testDb.transaction(async (tx) =>
        withIdempotencyKey(tx, { key: 'fk', userId: 99999, scope: SCOPE }, doWork)
      )
    ).rejects.toThrow();
    expect(doWork).not.toHaveBeenCalled();
  });

  it('absorbs a 23505 error with the code on the top-level error (real-pg shape)', async () => {
    // bun:sql (real pg) surfaces SQLSTATE on `err.code` directly; pg-mem
    // nested it under `err.cause.code`. Both must be recognised by
    // isUniqueViolation. We exercise the top-level-code branch by handing
    // withIdempotencyKey a fake tx whose `transaction` (the savepoint call)
    // rejects with an Error shaped like real pg, while `select` is delegated
    // to testDb so the conflict-resolution read finds the existing row.
    //
    // The original test nested a real testDb.transaction inside another to
    // inject the error -- PGlite is single-connection, so that deadlocks.
    await testDb.insert(idempotencyKeys).values({
      key: 'real-pg',
      userId: 1,
      scope: SCOPE,
      redirect: null,
      createdAt: new Date()
    });

    const fakeTx = {
      transaction: mock(() => {
        return Promise.reject(
          Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505'
          })
        );
      }),
      select: testDb.select.bind(testDb)
    };

    await expect(
      withIdempotencyKey(
        fakeTx as unknown as Parameters<typeof withIdempotencyKey>[0],
        { key: 'real-pg', userId: 1, scope: SCOPE },
        () => ({ redirect: '/should-not-run' })
      )
    ).rejects.toThrow(IdempotencyInFlight);
    expect(fakeTx.transaction).toHaveBeenCalledTimes(1);
  });

  it('isUniqueViolation distinguishes 23505 from other shapes', async () => {
    // Direct cover for the predicate's non-23505 branches: the helper must
    // reject everything that isn't shaped like a PK violation by re-throwing
    // instead of swallowing as a race. We force the inner savepoint call to
    // reject with a primitive non-Error value and assert it propagates.
    const fakeTx = {
      transaction: mock(() => Promise.reject('plain string')),
      select: testDb.select.bind(testDb)
    };

    await expect(
      withIdempotencyKey(
        fakeTx as unknown as Parameters<typeof withIdempotencyKey>[0],
        { key: 'plain', userId: 1, scope: SCOPE },
        () => ({ redirect: '/x' })
      )
    ).rejects.toBe('plain string');
    expect(fakeTx.transaction).toHaveBeenCalledTimes(1);
  });
});

describe('pruneExpiredKeys', () => {
  beforeEach(async () => {
    await resetTestDb();
    await seedUser();
  });

  afterEach(() => {
    setSystemTime(null);
  });

  it('deletes only rows older than the threshold and returns the count', async () => {
    const now = new Date('2026-05-07T12:00:00Z');
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers({ toFake: ['Date'] }) */
    setSystemTime(now);

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
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers({ toFake: ['Date'] }) */
    setSystemTime(now);

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

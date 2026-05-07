import { eq, lt } from 'drizzle-orm';
import { idempotencyKeys } from './db/schema';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema';

type Tx = BetterSQLite3Database<typeof schema>;

export class IdempotencyInFlight extends Error {
  readonly name = 'IdempotencyInFlight' as const;
}

export class IdempotencyScopeMismatch extends Error {
  readonly name = 'IdempotencyScopeMismatch' as const;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * MUST be called inside `db.transaction((tx) => ...)`, never with the bare `db` singleton.
 * The fresh-key check is a SELECT followed by an INSERT; outside a transaction two concurrent
 * first-time requests could both pass the SELECT and both INSERT, breaking the guarantee.
 * The transaction also gives free rollback of the inserted key row when `doWork()` throws
 * (verified by test 5).
 */
export function withIdempotencyKey<T extends { redirect: string }>(
  tx: Tx,
  args: { key: string; userId: number; scope: string },
  doWork: () => T
): { kind: 'fresh' | 'replay'; redirect: string } {
  const existing = tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, args.key)).get();

  if (existing) {
    if (existing.scope !== args.scope) {
      throw new IdempotencyScopeMismatch(`scope mismatch for key ${args.key}`);
    }
    if (existing.redirect == null) {
      throw new IdempotencyInFlight(`in-flight key ${args.key}`);
    }
    return { kind: 'replay', redirect: existing.redirect };
  }

  tx.insert(idempotencyKeys)
    .values({
      key: args.key,
      userId: args.userId,
      scope: args.scope,
      redirect: null,
      createdAt: new Date()
    })
    .run();

  const result = doWork();

  tx.update(idempotencyKeys)
    .set({ redirect: result.redirect })
    .where(eq(idempotencyKeys.key, args.key))
    .run();

  return { kind: 'fresh', redirect: result.redirect };
}

export function pruneExpiredKeys(tx: Tx, olderThanMs: number = TWENTY_FOUR_HOURS_MS): number {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = tx.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff)).run();
  return result.changes;
}

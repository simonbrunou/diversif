import { eq, lt } from 'drizzle-orm';
import { idempotencyKeys } from './db/schema';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type * as schema from './db/schema';

// bun:sqlite is synchronous and serializes writers (one writer per database),
// so the SELECT-then-INSERT below is race-free inside a transaction without the
// savepoint + 23505 dance the Postgres driver required. Both the bare db handle
// and a transaction handle satisfy this type.
type Tx =
  | BunSQLiteDatabase<typeof schema>
  | SQLiteTransaction<'sync', void, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export class IdempotencyInFlight extends Error {
  readonly name = 'IdempotencyInFlight' as const;
}

export class IdempotencyScopeMismatch extends Error {
  readonly name = 'IdempotencyScopeMismatch' as const;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * MUST be called inside `db.transaction((tx) => ...)`, never with the bare `db`
 * singleton. The fresh-key check is a SELECT followed by an INSERT; SQLite
 * serializes writers, so within the transaction two concurrent first-time
 * requests can't both pass the SELECT. The transaction also gives free rollback
 * of the inserted key row when `doWork()` throws.
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
  const deleted = tx
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.createdAt, cutoff))
    .returning({ key: idempotencyKeys.key })
    .all();
  return deleted.length;
}

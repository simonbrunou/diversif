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
    // `key` is the table's bare primary key, so folding a userId equality
    // into the SELECT's WHERE would make a legitimate cross-user collision
    // look identical to "no existing row" — the code below would then try
    // to INSERT a second row with the same PK and blow up with an unhandled
    // constraint violation instead of the clean 409 callers already expect.
    // Compare userId explicitly instead, and fold it into the same
    // IdempotencyScopeMismatch branch: a mismatched owner is the same class
    // of "this key doesn't belong to this caller's context" collision as a
    // mismatched scope, and callers already map that error to a 409 with no
    // changes needed here.
    if (existing.scope !== args.scope) {
      throw new IdempotencyScopeMismatch(`scope mismatch for key ${args.key}`);
    }
    if (existing.userId !== args.userId) {
      throw new IdempotencyScopeMismatch(`owner mismatch for key ${args.key}`);
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

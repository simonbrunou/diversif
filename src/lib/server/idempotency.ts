import { eq, lt } from 'drizzle-orm';
import { idempotencyKeys } from './db/schema';
import type { NodePgDatabase, NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type * as schema from './db/schema';

type Tx =
  | NodePgDatabase<typeof schema>
  | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export class IdempotencyInFlight extends Error {
  readonly name = 'IdempotencyInFlight' as const;
}

export class IdempotencyScopeMismatch extends Error {
  readonly name = 'IdempotencyScopeMismatch' as const;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * MUST be called inside `await db.transaction(async (tx) => ...)`, never with the bare `db`
 * singleton. The fresh-key check is a SELECT followed by an INSERT; outside a transaction two
 * concurrent first-time requests could both pass the SELECT and both INSERT, breaking the
 * guarantee. The transaction also gives free rollback of the inserted key row when `doWork()`
 * throws.
 */
export async function withIdempotencyKey<T extends { redirect: string }>(
  tx: Tx,
  args: { key: string; userId: number; scope: string },
  doWork: () => Promise<T> | T
): Promise<{ kind: 'fresh' | 'replay'; redirect: string }> {
  const existingRows = await tx
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, args.key))
    .limit(1);
  const existing = existingRows[0];

  if (existing) {
    if (existing.scope !== args.scope) {
      throw new IdempotencyScopeMismatch(`scope mismatch for key ${args.key}`);
    }
    if (existing.redirect == null) {
      throw new IdempotencyInFlight(`in-flight key ${args.key}`);
    }
    return { kind: 'replay', redirect: existing.redirect };
  }

  await tx.insert(idempotencyKeys).values({
    key: args.key,
    userId: args.userId,
    scope: args.scope,
    redirect: null,
    createdAt: new Date()
  });

  const result = await doWork();

  await tx
    .update(idempotencyKeys)
    .set({ redirect: result.redirect })
    .where(eq(idempotencyKeys.key, args.key));

  return { kind: 'fresh', redirect: result.redirect };
}

export async function pruneExpiredKeys(
  tx: Tx,
  olderThanMs: number = TWENTY_FOUR_HOURS_MS
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await tx.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, cutoff));
  /* v8 ignore next — node-postgres always populates rowCount for DELETE */
  return result.rowCount ?? 0;
}

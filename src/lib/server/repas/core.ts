import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { DB } from '#lib/server/db/index.js';
import type * as schema from '#lib/server/db/schema.js';
import type { MealDateErrorKey } from '#lib/utils/meal-date.js';
import type { ReactionsByEntry } from '#lib/utils/reaction-values.js';

// bun:sqlite transactions are synchronous: every repas write runs inside one
// `db.transaction((tx) => …)` with no awaits, and the database serializes
// writers for us.
export type Tx = SQLiteTransaction<
  'sync',
  void,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
export type Executor = DB | Tx;

/** Every error key a repas write can refuse with (keys of messages/*.json). */
export type RepasErrorKey =
  | MealDateErrorKey
  | 'errorsAuthBadInput'
  | 'errorsFoodEntryNotFound'
  | 'errorsLogDateInvalid'
  | 'errorsLogDateRequired'
  | 'errorsLogFoodNotFound'
  | 'errorsLogIdempotencyConflict'
  | 'errorsLogIdempotencyKeyInvalid'
  | 'errorsLogInvalidRequest'
  | 'errorsLogMealNotFound'
  | 'errorsLogNoFoodSelected'
  | 'errorsLogNoteTooLong'
  | 'errorsLogReactionChanged'
  | 'errorsLogTextureInvalid'
  | 'errorsLogTooManyFoods';

/**
 * Thrown inside a repas transaction to roll it back and refuse the write.
 * Never escapes the module: the public operations turn it into a refusal.
 */
export class RepasAbort extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly errorKey: RepasErrorKey,
    /** The rows' stored reactions, by entry id, when a reaction edit lost a race. */
    readonly reactions?: ReactionsByEntry
  ) {
    super(errorKey);
    this.name = 'RepasAbort';
  }
}

export function refuse(errorKey: RepasErrorKey): never {
  throw new RepasAbort(400, errorKey);
}

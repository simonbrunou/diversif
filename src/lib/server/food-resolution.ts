import { and, eq, isNull, or } from 'drizzle-orm';
import { db, type DB } from './db';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { foods } from './db/schema';
import type * as schema from './db/schema';
import { CATEGORY_IDS } from '$lib/utils/categories';

// Accepts either the bare db handle or a transaction handle so the insert can
// participate in an outer transaction. bun:sqlite is synchronous, so this runs
// inline inside the caller's sync `db.transaction((tx) => ...)`.
type Executor =
  | DB
  | SQLiteTransaction<'sync', void, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export type ResolveFoodInput = {
  /** ID of an existing food from the global catalog or this child's custom foods. */
  foodId?: number | null;
  /** Name for a new custom food (mutually exclusive with foodId). */
  customName?: string | null;
  /** Category slug for the custom food; falls back to 'autre' when absent or unrecognised. */
  customCategory?: string | null;
  /** The child the entry belongs to — used to scope custom-food visibility. */
  childId: number;
};

export type ResolveFoodResult =
  | { ok: true; food: typeof foods.$inferSelect; foodId: number }
  | { ok: false; reason: 'not-found' | 'invalid-custom' };

/**
 * Resolve a food for a log entry: either look up an existing food by id, or
 * insert a new custom food and return it. Validates that the resolved food is
 * accessible to the given child (global catalog or owned custom food).
 *
 * The helper is transaction-aware: pass a Drizzle tx instance when you need the
 * insert to participate in an outer transaction, or omit it to run against the
 * default db connection.
 *
 * Usage:
 *   const result = resolveOrInsertFood({ foodId, customName, customCategory, childId }, tx);
 *   if (!result.ok) return fail(400, { error: result.reason === 'not-found' ? 'Aliment introuvable.' : 'Aliment invalide.' });
 *   const { food, foodId: resolvedId } = result;
 */
export function resolveOrInsertFood(input: ResolveFoodInput, tx: Executor = db): ResolveFoodResult {
  const customName = input.customName?.trim();

  // Resolve to a foodId — either reuse the provided one or insert a new custom
  // row. The else branch is the bail-out for callers that forgot to provide
  // either.
  let resolvedId: number;
  if (input.foodId) {
    resolvedId = input.foodId;
  } else if (customName) {
    const category =
      input.customCategory?.trim() && CATEGORY_IDS.includes(input.customCategory.trim())
        ? input.customCategory.trim()
        : 'autre';

    const inserted = tx
      .insert(foods)
      .values({
        name: customName,
        category,
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 0,
        notes: null,
        isCustom: true,
        customForChildId: input.childId
      })
      .returning({ id: foods.id })
      .all()[0];

    resolvedId = inserted.id;
  } else {
    return { ok: false, reason: 'invalid-custom' };
  }

  // Verify the food is accessible: either from the global catalog or owned by
  // this child. This is the same guard used in log/+page.server.ts.
  const food = tx
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, resolvedId),
        or(isNull(foods.customForChildId), eq(foods.customForChildId, input.childId))
      )
    )
    .limit(1)
    .all()[0];

  if (!food) {
    return { ok: false, reason: 'not-found' };
  }

  return { ok: true, food, foodId: resolvedId };
}

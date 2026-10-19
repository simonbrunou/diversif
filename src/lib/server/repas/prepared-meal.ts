import { and, eq, sql } from 'drizzle-orm';
import { preparedMeals } from '#lib/server/db/schema.js';
import { refuse, type Tx } from './core';
import type { PreparedMealChoice } from './fields';

/**
 * Save or touch the plat préparé a repas was logged from. A named one is
 * upserted with this repas's aliments; a picked saved one must belong to the
 * child. lastUsedAt only moves forward, so backdating a repas doesn't demote
 * a plat préparé used more recently.
 */
export function recordPreparedMeal(
  tx: Tx,
  childId: number,
  choice: PreparedMealChoice,
  foodIds: number[],
  givenAt: Date
): void {
  if (!choice) return;
  const now = new Date();
  const latestUse = sql`max(coalesce(${preparedMeals.lastUsedAt}, 0), ${givenAt.getTime()})`;

  if ('brand' in choice) {
    tx.insert(preparedMeals)
      .values({
        childId,
        brand: choice.brand,
        name: choice.name,
        ingredientFoodIds: foodIds,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: givenAt
      })
      .onConflictDoUpdate({
        target: [preparedMeals.childId, preparedMeals.brand, preparedMeals.name],
        set: { ingredientFoodIds: foodIds, updatedAt: now, lastUsedAt: latestUse }
      })
      .run();
    return;
  }

  const owned = and(eq(preparedMeals.id, choice.id), eq(preparedMeals.childId, childId));
  const touched = tx
    .update(preparedMeals)
    .set({ updatedAt: now, lastUsedAt: latestUse })
    .where(owned)
    .returning({ id: preparedMeals.id })
    .all();
  if (touched.length === 0) refuse('errorsAuthBadInput');
}

import { and, eq, inArray } from 'drizzle-orm';
import { foods } from '#lib/server/db/schema.js';
import { visibleToChild } from '#lib/server/food-resolution.js';
import { CATEGORY_IDS } from '#lib/utils/categories.js';
import { normalize } from '#lib/utils/search.js';
import { refuse, type Tx } from './core';
import type { AlimentChoice } from './fields';

export type Aliment = typeof foods.$inferSelect;

/**
 * Resolve the aliments a form names, inside the repas transaction: catalog ids
 * must be visible to the child (global catalog or its own custom aliments),
 * and a new custom aliment is inserted, so it rolls back with the rest of the
 * repas. Returns each aliment once, in posted order, custom last.
 */
export function resolveAliments(tx: Tx, childId: number, choice: AlimentChoice): Aliment[] {
  const resolved = new Map<number, Aliment>();

  // One batched lookup instead of one query per posted id.
  if (choice.foodIds.length > 0) {
    const rows = tx
      .select()
      .from(foods)
      .where(and(inArray(foods.id, choice.foodIds), visibleToChild(childId)))
      .all();
    const byId = new Map(rows.map((food) => [food.id, food]));
    for (const id of choice.foodIds) {
      resolved.set(id, byId.get(id) ?? refuse('errorsLogFoodNotFound'));
    }
  }

  if (choice.custom) {
    const food = customAliment(tx, childId, choice.custom.name, choice.custom.category);
    if (!resolved.has(food.id)) resolved.set(food.id, food);
  }

  return [...resolved.values()];
}

// Dedup guard: a retried submit (double-tap, resubmit after an error) must
// reuse the child's existing custom aliment instead of inserting a second row
// with the same name and splitting its history across two cards. Scoped to
// this child's own custom aliments: global-catalog matches go through foodId.
function customAliment(
  tx: Tx,
  childId: number,
  name: string,
  category: string | undefined
): Aliment {
  const wanted = normalize(name);
  const existing = tx
    .select()
    .from(foods)
    .where(eq(foods.customForChildId, childId))
    .all()
    .find((food) => normalize(food.name) === wanted);
  if (existing) return existing;

  const knownCategory = category?.trim();
  return tx
    .insert(foods)
    .values({
      name,
      category: knownCategory && CATEGORY_IDS.includes(knownCategory) ? knownCategory : 'autre',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 0,
      notes: null,
      isCustom: true,
      customForChildId: childId
    })
    .returning()
    .all()[0];
}

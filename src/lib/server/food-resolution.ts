import { eq, isNull, or } from 'drizzle-orm';
import { db } from './db';
import { foods } from './db/schema';

/**
 * A food is visible to a child if it's in the global catalog (no owner) or
 * was created as a custom food for this specific child.
 *
 * Extracted so the predicate lives in exactly one place: the log and edit
 * pickers below and the repas write module's aliment resolution.
 */
export function visibleToChild(childId: number) {
  return or(isNull(foods.customForChildId), eq(foods.customForChildId, childId));
}

/** The food list a child's log/edit pickers show: global catalog + this child's own custom foods. */
export async function loadVisibleFoodsForChild(childId: number) {
  return db
    .select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      allergenType: foods.allergenType
    })
    .from(foods)
    .where(visibleToChild(childId))
    .orderBy(foods.name);
}

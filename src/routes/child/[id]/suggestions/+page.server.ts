import { db } from '#lib/server/db/index.js';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { and, eq, lte, notInArray, sql } from 'drizzle-orm';
import { isPriorityAllergen } from '#lib/utils/allergens.js';
import { ageInMonths } from '#lib/utils/age.js';
import { requireChildContext } from '#lib/server/guards.js';
import { loadAllergenHistory } from '#lib/server/guidance/allergen-history.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  // One instant for the whole page: the age and the allergen history.
  const now = Date.now();
  const months = ageInMonths(child.birthDate, new Date(now));

  if (months < 4) return { ageMonths: months, priorityAllergens: [], others: [] };

  const introducedIds = (
    await db
      .selectDistinct({ id: foodEntries.foodId })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
  ).map((r) => r.id);

  const allergens = loadAllergenHistory(db, childId, now);

  const conditions = [lte(foods.suggestedAgeMonths, months), eq(foods.isCustom, false)];
  if (introducedIds.length > 0) {
    conditions.push(notInArray(foods.id, introducedIds));
  }

  const candidates = await db
    .select()
    .from(foods)
    .where(and(...conditions))
    .orderBy(sql`${foods.suggestedAgeMonths} ASC, ${foods.name} ASC`);

  // Common allergens not to delay are grouped first, with the foods that would
  // count as their introduction. Any allergen associated with symptoms is
  // excluded entirely pending medical review.
  const introducesPriorityAllergen = (food: (typeof candidates)[number]) =>
    allergens.isExposureFood(food) &&
    isPriorityAllergen(food.allergenType) &&
    !allergens.isIntroduced(food.allergenType);

  const safeCandidates = candidates.filter(
    (food) => !food.allergenType || !allergens.isBlocked(food.allergenType)
  );
  const priority = safeCandidates.filter(introducesPriorityAllergen);
  const others = safeCandidates.filter((food) => !introducesPriorityAllergen(food));

  return {
    ageMonths: months,
    priorityAllergens: priority,
    others
  };
};

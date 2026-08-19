import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, eq, lte, notInArray, sql } from 'drizzle-orm';
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
import { ageInMonths } from '$lib/utils/age';
import { requireChildContext } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  const months = ageInMonths(child.birthDate);

  if (months < 4) return { ageMonths: months, priorityAllergens: [], others: [] };

  const introducedIds = (
    await db
      .selectDistinct({ id: foodEntries.foodId })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
  ).map((r) => r.id);

  const allergenEntries = await db
    .selectDistinct({ allergenType: foods.allergenType, reaction: foodEntries.reaction })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId));
  const introducedAllergens = allergenEntries
    .map((row) => row.allergenType)
    .filter((value): value is string => !!value);

  const introducedAllergenSet = new Set(introducedAllergens);
  const blockedAllergenSet = new Set(
    allergenEntries
      .filter((row) => row.reaction !== 'ras')
      .map((row) => row.allergenType)
      .filter((value): value is string => !!value)
  );

  const conditions = [lte(foods.suggestedAgeMonths, months), eq(foods.isCustom, false)];
  if (introducedIds.length > 0) {
    conditions.push(notInArray(foods.id, introducedIds));
  }

  const candidates = await db
    .select()
    .from(foods)
    .where(and(...conditions))
    .orderBy(sql`${foods.suggestedAgeMonths} ASC, ${foods.name} ASC`);

  // Common allergens not to delay are grouped first. Any allergen associated
  // with symptoms is excluded entirely pending medical review.
  const allergenSet = new Set<string>(
    PRIORITY_INTRODUCTION_ALLERGENS.filter((id) => !introducedAllergenSet.has(id))
  );

  const safeCandidates = candidates.filter(
    (food) => !food.allergenType || !blockedAllergenSet.has(food.allergenType)
  );
  const priority = safeCandidates.filter(
    (food) => food.allergenType && allergenSet.has(food.allergenType)
  );
  const others = safeCandidates.filter(
    (food) => !food.allergenType || !allergenSet.has(food.allergenType)
  );

  return {
    ageMonths: months,
    priorityAllergens: priority,
    others
  };
};

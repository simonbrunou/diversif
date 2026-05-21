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

  const introducedIds = (
    await db
      .selectDistinct({ id: foodEntries.foodId })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
  ).map((r) => r.id);

  const introducedAllergens = (
    await db
      .selectDistinct({ allergenType: foods.allergenType })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(eq(foodEntries.childId, childId))
  )
    .map((r) => r.allergenType)
    .filter((x): x is string => !!x);

  const introducedAllergenSet = new Set(introducedAllergens);

  const ageThreshold = Math.max(months, 4);
  const conditions = [lte(foods.suggestedAgeMonths, ageThreshold), eq(foods.isCustom, false)];
  if (introducedIds.length > 0) {
    conditions.push(notInArray(foods.id, introducedIds));
  }

  const candidates = await db
    .select()
    .from(foods)
    .where(and(...conditions))
    .orderBy(sql`${foods.suggestedAgeMonths} ASC, ${foods.name} ASC`);

  // Only surface "Allergènes à introduire" prompts for the priority subset
  // (LEAP/EAT/ESPGHAN-supported). Soja and the EU-1169-only allergens
  // (céleri, moutarde, crustacés, mollusques) are intentionally excluded
  // : see PRIORITY_INTRODUCTION_ALLERGENS for the reasoning.
  const allergenSet = new Set<string>(
    PRIORITY_INTRODUCTION_ALLERGENS.filter((id) => !introducedAllergenSet.has(id))
  );

  const priority = candidates.filter((f) => f.allergenType && allergenSet.has(f.allergenType));
  const others = candidates.filter((f) => !f.allergenType || !allergenSet.has(f.allergenType));

  return {
    ageMonths: months,
    priorityAllergens: priority,
    others
  };
};

import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, eq, lte, notInArray, sql } from 'drizzle-orm';
import { ALLERGENS } from '$lib/utils/allergens';
import { ageInMonths } from '$lib/utils/age';
import { requireMembership } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const childId = Number(params.id);
  requireMembership(locals, childId);
  const { child } = await parent();
  const months = ageInMonths(child.birthDate);

  const introducedIds = db
    .selectDistinct({ id: foodEntries.foodId })
    .from(foodEntries)
    .where(eq(foodEntries.childId, childId))
    .all()
    .map((r) => r.id);

  const introducedAllergens = db
    .selectDistinct({ allergenType: foods.allergenType })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId))
    .all()
    .map((r) => r.allergenType)
    .filter((x): x is string => !!x);

  const introducedAllergenSet = new Set(introducedAllergens);

  const ageThreshold = Math.max(months, 4);
  const conditions = [lte(foods.suggestedAgeMonths, ageThreshold), eq(foods.isCustom, false)];
  if (introducedIds.length > 0) {
    conditions.push(notInArray(foods.id, introducedIds));
  }

  const candidates = db
    .select()
    .from(foods)
    .where(and(...conditions))
    .orderBy(sql`${foods.suggestedAgeMonths} ASC, ${foods.name} ASC`)
    .all();

  const allergenPriority = ALLERGENS.filter((a) => !introducedAllergenSet.has(a.id)).map(
    (a) => a.id as string
  );
  const allergenSet = new Set<string>(allergenPriority);

  const priority = candidates.filter((f) => f.allergenType && allergenSet.has(f.allergenType));
  const others = candidates.filter((f) => !f.allergenType || !allergenSet.has(f.allergenType));

  return {
    ageMonths: months,
    priorityAllergens: priority,
    others
  };
};

import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, eq, lte, sql } from 'drizzle-orm';
import { ageInMonths } from '$lib/utils/age';
import { REACTION_RANK } from '$lib/utils/reaction-values';
import { requireChildContext } from '$lib/server/guards';
import { buildMenu } from '$lib/server/menu/engine';
import { parisDay } from '$lib/server/menu/day';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  const ageMonths = ageInMonths(child.birthDate);

  const entries = await db
    .select({
      foodId: foodEntries.foodId,
      reaction: foodEntries.reaction,
      allergenType: foods.allergenType
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId));

  const introducedFoodIds = new Set<number>();
  const introducedAllergens = new Set<string>();
  const avoidFoodIds = new Set<number>();
  const reactionTierFoodIds = new Set<number>();
  const reactedAllergens = new Set<string>();
  for (const e of entries) {
    introducedFoodIds.add(e.foodId);
    if (e.allergenType) introducedAllergens.add(e.allergenType);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['inconfort']) avoidFoodIds.add(e.foodId);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['reaction']) {
      reactionTierFoodIds.add(e.foodId);
      if (e.allergenType) reactedAllergens.add(e.allergenType);
    }
  }

  const catalog = await db
    .select()
    .from(foods)
    .where(and(eq(foods.isCustom, false), lte(foods.suggestedAgeMonths, Math.max(ageMonths, 4))))
    .orderBy(sql`${foods.id} ASC`);

  const { dayIndex, weekday } = parisDay(Date.now());
  // Phase 2: the column doesn't exist yet, so cast the row (not the value) to reach the
  // optional property without a "does not exist" typecheck error. Phase 3 drops the cast.
  const dietaryExclusions = (child as { dietaryExclusions?: string[] }).dietaryExclusions ?? [];

  const menu = buildMenu({
    childId,
    ageMonths,
    dayIndex,
    weekday,
    catalog,
    introducedFoodIds,
    avoidFoodIds,
    reactionTierFoodIds,
    introducedAllergens,
    reactedAllergens,
    dietaryExclusions
  });

  return { ageMonths, menu };
};

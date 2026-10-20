import { db } from '#lib/server/db/index.js';
import { children, foodEntries, foods } from '#lib/server/db/schema.js';
import { and, eq, lte, sql } from 'drizzle-orm';
import { ageInMonths } from '#lib/utils/age.js';
import { REACTION_RANK } from '#lib/utils/reaction-values.js';
import { parseDietExclusions } from '#lib/utils/diet.js';
import { requireChildContext } from '#lib/server/guards.js';
import { loadAllergenHistory } from '#lib/server/guidance/allergen-history.js';
import { buildMenu } from '#lib/server/menu/engine.js';
import { parisDayOf, weekdayOf } from '#lib/utils/civil-calendar.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  // One instant for the whole page: the age, the allergen history and the day.
  const now = Date.now();
  const ageMonths = ageInMonths(child.birthDate, new Date(now));

  const entries = await db
    .select({ foodId: foodEntries.foodId, reaction: foodEntries.reaction })
    .from(foodEntries)
    .where(eq(foodEntries.childId, childId));

  // Food-level history; the allergen-level one comes from the allergen history.
  const introducedFoodIds = new Set<number>();
  const avoidFoodIds = new Set<number>();
  const reactionTierFoodIds = new Set<number>();
  for (const e of entries) {
    introducedFoodIds.add(e.foodId);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['inconfort']) avoidFoodIds.add(e.foodId);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['reaction']) reactionTierFoodIds.add(e.foodId);
  }
  const allergens = loadAllergenHistory(db, childId, now);

  const catalog = await db
    .select()
    .from(foods)
    .where(and(eq(foods.isCustom, false), lte(foods.suggestedAgeMonths, Math.max(ageMonths, 4))))
    .orderBy(sql`${foods.id} ASC`);

  const dayIndex = parisDayOf(now);
  const weekday = weekdayOf(dayIndex);
  // Hand-picked projection (just the column the engine needs) rather than
  // reusing the +layout.server.ts child object, which every child/[id]/*
  // route consumes : keeping this query local avoids widening that shared
  // shape for a field only this page needs — mirrors the settings loader's
  // childDiet query.
  const [dietRow] = await db
    .select({ dietaryExclusions: children.dietaryExclusions })
    .from(children)
    .where(eq(children.id, childId))
    .limit(1);
  // Re-validate on READ (not just on write): parseDietExclusions returns []
  // for a missing row and drops any stale/foreign tag a future enum rename,
  // manual DB edit, or restore might leave in the JSON — same rationale as
  // the settings loader's read-side re-validation.
  const dietaryExclusions = parseDietExclusions(dietRow?.dietaryExclusions);

  const menu = buildMenu({
    childId,
    ageMonths,
    dayIndex,
    weekday,
    catalog,
    introducedFoodIds,
    avoidFoodIds,
    reactionTierFoodIds,
    allergens,
    dietaryExclusions
  });

  return { ageMonths, menu };
};

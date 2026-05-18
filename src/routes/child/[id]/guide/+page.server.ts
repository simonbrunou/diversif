import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { chooseSuggestedFoods } from '$lib/utils/suggest';
import { loadDismissals } from '$lib/server/guidance/queries';
import type { PageServerLoad } from './$types';

const TODAY_TIP = {
  id: 'tip-allergen-eggs',
  title: "Introduire l'œuf tôt",
  body: "LEAP recommande l'introduction de l'œuf entre 4 et 11 mois."
} as const;

export const load: PageServerLoad = async ({ parent, locals }) => {
  const { child } = await parent();
  const months = ageInMonths(child.birthDate);
  const currentStageId = getStageForAgeMonths(months).id;

  // Fetch recent food entries for suggestions
  const recentRows = await db
    .select({
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, child.id))
    .orderBy(desc(foodEntries.givenAt))
    .limit(20);

  const recent = recentRows.map((r) => {
    const ts = r.givenAt as unknown;
    return {
      foodId: r.foodId,
      foodName: r.foodName,
      category: r.category,
      allergenType: r.allergenType,
      givenAt: ts instanceof Date ? ts.getTime() : /* v8 ignore next */ Number(ts)
    };
  });

  const suggestions = chooseSuggestedFoods({
    starterFoods: [],
    recent,
    priorityAllergensTodo: [],
    now: Date.now(),
    count: 5
  });

  // Tip dismissal: go through loadDismissals so the TTL conventions (info: 30d,
  // warn: 90d, important: never) and the per-child scoping match the dashboard's
  // reminder-strip read. Without this, a dismissal would persist forever here
  // even though the dashboard re-surfaces it after 30 days.
  const dismissals = await loadDismissals(locals.user!.id, child.id);
  const tipDismissed = dismissals.has(TODAY_TIP.id);

  const stages = getAllStagesForBento();

  return {
    ageMonths: months,
    currentStageId,
    stages,
    suggestions,
    todayTip: TODAY_TIP,
    tipDismissed
  };
};

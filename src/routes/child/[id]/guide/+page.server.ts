import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { db } from '$lib/server/db';
import { foodEntries, foods, tipDismissals } from '$lib/server/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { chooseSuggestedFoods } from '$lib/utils/suggest';
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

  // Tip dismissal — check against tip_dismissals using reminderKey column
  const dismissed = await db
    .select()
    .from(tipDismissals)
    .where(
      and(eq(tipDismissals.userId, locals.user!.id), eq(tipDismissals.reminderKey, TODAY_TIP.id))
    );
  const tipDismissed = dismissed.length > 0;

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

import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { getRecipesForStage } from '$lib/content/recipes';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { chooseSuggestedFoods } from '$lib/utils/suggest';
import { loadSeasonalFoods, loadTextureProgress } from '$lib/server/guidance/queries';
import { loadAllergenStatus } from '$lib/server/guidance/allergen-status';
import { toEpochMs } from '$lib/utils/dates';
import { FACT_CARDS } from '$lib/content/did-you-know';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
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

  const recent = recentRows.map((r) => ({
    foodId: r.foodId,
    foodName: r.foodName,
    category: r.category,
    allergenType: r.allergenType,
    givenAt: toEpochMs(r.givenAt as Date | number | string)
  }));

  const suggestions = chooseSuggestedFoods({
    starterFoods: [],
    recent,
    priorityAllergensTodo: [],
    now: Date.now(),
    count: 5
  });

  const stages = getAllStagesForBento();
  const allergens = await loadAllergenStatus(child.id);
  const textureProgress = await loadTextureProgress(child.id);
  const now = new Date();
  const currentMonth = now.getUTCMonth() + 1;
  const seasonalFoods = await loadSeasonalFoods(months, currentMonth);
  const recipes = getRecipesForStage(currentStageId);

  return {
    ageMonths: months,
    currentStageId,
    stages,
    suggestions,
    allergens,
    textureProgress,
    seasonalFoods,
    currentMonth,
    recipes,
    factCards: FACT_CARDS
  };
};

export type SuggestFood = {
  id: number;
  name: string;
  category: string;
  allergenType: string | null;
};

export type SuggestRecent = {
  foodId: number;
  foodName?: string;
  category?: string;
  allergenType?: string | null;
  givenAt: number;
};

export type SuggestionReason = 'allergen' | 'diversify' | 'recent';

export type RankedSuggestion = {
  food: SuggestFood;
  reason: SuggestionReason;
};

export function chooseSuggestedFoods(args: {
  starterFoods: SuggestFood[];
  recent: SuggestRecent[];
  priorityAllergensTodo: SuggestFood[];
  now: number;
  count: number;
}): RankedSuggestion[] {
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const out: RankedSuggestion[] = [];
  const seen = new Set<number>();

  for (const allergen of args.priorityAllergensTodo) {
    if (out.length >= args.count) break;
    if (seen.has(allergen.id)) continue;
    out.push({ food: allergen, reason: 'allergen' });
    seen.add(allergen.id);
  }

  const recentCategories = new Set(args.recent.slice(0, 5).map((r) => r.category));
  const recentFoodIds = new Set(args.recent.map((r) => r.foodId));

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    if (recentFoodIds.has(food.id)) continue;
    if (!recentCategories.has(food.category)) {
      out.push({ food, reason: 'diversify' });
      seen.add(food.id);
    }
  }

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    const lastEaten = args.recent.find((r) => r.foodId === food.id);
    if (lastEaten && args.now - lastEaten.givenAt > TWO_WEEKS_MS) {
      out.push({ food, reason: 'recent' });
      seen.add(food.id);
    }
  }

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    out.push({ food, reason: 'diversify' });
    seen.add(food.id);
  }

  return out;
}

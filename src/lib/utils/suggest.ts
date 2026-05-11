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

type Input = {
  starterFoods: SuggestFood[];
  recent: SuggestRecent[];
  priorityAllergensTodo: SuggestFood[];
  now: number;
};

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function chooseSuggestedFood(input: Input): SuggestFood | null {
  // 1. priority allergen marked à essayer wins
  if (input.priorityAllergensTodo.length > 0) {
    return input.priorityAllergensTodo[0];
  }
  // 2. first starter food NOT already in recent
  const recentIds = new Set(input.recent.map((r) => r.foodId));
  const fresh = input.starterFoods.find((f) => !recentIds.has(f.id));
  if (fresh) return fresh;
  // 3. a recent food whose last log is > 14 days old, re-expose it
  const stale = input.recent.find(
    (r) => input.now - r.givenAt > FOURTEEN_DAYS_MS && r.foodName && r.category != null
  );
  if (stale) {
    return {
      id: stale.foodId,
      name: stale.foodName!,
      category: stale.category!,
      allergenType: stale.allergenType ?? null
    };
  }
  return null;
}

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

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

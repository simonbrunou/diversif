import { REACTION_RANK } from '$lib/utils/reaction-values';
import type { ReactionId } from '$lib/utils/reactions';

export type MealGroup<T> = {
  mealId: string | null;
  members: T[];
  worst: ReactionId;
  givenAt: number;
};

/**
 * Fold entry rows into meal groups. Rows MUST be pre-sorted (givenAt desc, id
 * asc) so a meal's ingredients are contiguous. Null-mealId rows are singletons.
 */
export function groupByMeal<
  T extends { id: number; mealId: string | null; givenAt: number; reaction: ReactionId }
>(rows: T[]): MealGroup<T>[] {
  const groups: MealGroup<T>[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    // Loose `!= null` is deliberate and fail-safe. For the typed value space
    // (`string | null`) it is identical to `!== null`, but a contract-violating
    // `undefined` mealId is forced to its own singleton instead of silently
    // merging with an adjacent `undefined` row (`undefined === undefined`).
    // Matches the doc comment above ("Null-mealId rows are singletons"). Do NOT
    // tighten to `!==` — see the fail-safe test in meals.test.ts.
    if (r.mealId != null && last && last.mealId === r.mealId) {
      last.members.push(r);
      if (REACTION_RANK[r.reaction] > REACTION_RANK[last.worst]) last.worst = r.reaction;
    } else {
      groups.push({ mealId: r.mealId, members: [r], worst: r.reaction, givenAt: r.givenAt });
    }
  }
  return groups;
}

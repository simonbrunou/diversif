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
    if (r.mealId !== null && last && last.mealId === r.mealId) {
      last.members.push(r);
      if (REACTION_RANK[r.reaction] > REACTION_RANK[last.worst]) last.worst = r.reaction;
    } else {
      groups.push({ mealId: r.mealId, members: [r], worst: r.reaction, givenAt: r.givenAt });
    }
  }
  return groups;
}

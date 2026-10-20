import { and, eq, ne, sql } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { ALLERGENS, PRIORITY_INTRODUCTION_ALLERGENS } from '#lib/utils/allergens.js';
import {
  loadAllergenHistory,
  type AllergenHistory
} from '#lib/server/guidance/allergen-history.js';
import type { Milestones } from '#lib/utils/milestones.js';
import type { Tx } from './core';

// Milestone measurement for a new repas: a snapshot before the insert (counts
// and the allergen history), the same reads after it, and the difference as
// typed Milestones. The URL
// encoding lives with its decoder in src/lib/utils/milestones.ts.

// An aggregate query always returns one row; the fallback only satisfies the type.
function countOf(rows: { n: number }[]): number {
  return rows[0]?.n /* v8 ignore next */ ?? 0;
}

// Categories covered for a child, excluding the `autre` bucket so this count
// shares a denominator with the milestone toasts (TRACKED_CATEGORY_COUNT in
// #lib/utils/categories).
function countCategoriesCovered(tx: Tx, childId: number): number {
  return countOf(
    tx
      .select({ n: sql<number>`count(distinct ${foods.category})` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
      .limit(1)
      .all()
  );
}

export type MilestoneBaseline = {
  priorEntryCount: number;
  priorCategoriesCovered: number;
  priorAllergens: AllergenHistory; // pre-insert
};

// Snapshot pre-insert state so milestones (first food, first allergen(s),
// all-allergens, category progress) can be detected once the repas rows are
// inserted. priorAllergens MUST be read here, before any insert in this
// transaction: reading the history after the insert loop would include the
// repas's own just-inserted rows, so every "first allergen" would look
// already-seen and the celebration would never fire.
export function milestoneBaseline(tx: Tx, childId: number, now: number): MilestoneBaseline {
  const priorEntryCount = countOf(
    tx
      .select({ n: sql<number>`count(*)` })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
      .limit(1)
      .all()
  );

  return {
    priorEntryCount,
    priorCategoriesCovered: countCategoriesCovered(tx, childId),
    priorAllergens: loadAllergenHistory(tx, childId, now)
  };
}

// The milestones celebrate an allergen once a reliable exposure was logged
// without symptoms (the history's isTolerated), matching the "proposé sans
// symptôme" copy, and never while it is blocked: both toasts go on to ask the
// parent to keep offering it (#373).
const isCelebrated = (allergens: AllergenHistory, id: string) =>
  allergens.isTolerated(id) && !allergens.isBlocked(id);
const allCelebrated = (allergens: AllergenHistory) =>
  ALLERGENS.every((a) => isCelebrated(allergens, a.id));

// This repas's milestones, by diffing the allergen history before and after
// the insert, which differ only by this repas's rows (every aliment, not just
// the first). Call after the rows are inserted, with the baseline taken before.
export function measureMilestones(
  tx: Tx,
  childId: number,
  baseline: MilestoneBaseline,
  now: number
): Milestones {
  const before = baseline.priorAllergens;
  const after = loadAllergenHistory(tx, childId, now); // post-insert
  // Celebrate only allergens for which the app actually recommends prompt
  // introduction; the wider 12-item EU tracking list includes soja and
  // allergens with no preventive introduction calendar.
  const firstAllergen =
    PRIORITY_INTRODUCTION_ALLERGENS.find(
      (id) => isCelebrated(after, id) && !before.isTolerated(id)
    ) ?? null;

  return {
    firstFood: baseline.priorEntryCount === 0,
    firstAllergen,
    allAllergens: allCelebrated(after) && !allCelebrated(before),
    categories: {
      before: baseline.priorCategoriesCovered,
      after: countCategoriesCovered(tx, childId)
    }
  };
}

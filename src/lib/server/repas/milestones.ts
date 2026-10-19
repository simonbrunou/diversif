import { and, eq, ne, sql } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import {
  ALLERGENS,
  ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY,
  PRIORITY_INTRODUCTION_ALLERGENS,
  countsAsAllergenExposure
} from '#lib/utils/allergens.js';
import type { Milestones } from '#lib/utils/milestones.js';
import type { Aliment } from './aliments';
import type { Tx } from './core';

// Milestone measurement for a new repas: a snapshot before the insert, the
// same counts after it, and the difference as typed Milestones. The URL
// encoding lives with its decoder in src/lib/utils/milestones.ts.

// An aggregate query always returns one row; the fallback only satisfies the type.
function countOf(rows: { n: number }[]): number {
  return rows[0]?.n /* v8 ignore next */ ?? 0;
}

// The child's tolerated allergen exposures, for milestones: a RAS entry of an
// aliment carrying an allergen, outside the excluded category (fats).
function toleratedAllergenExposure(childId: number) {
  return and(
    eq(foodEntries.childId, childId),
    eq(foodEntries.reaction, 'ras'),
    ne(foods.category, ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY),
    sql`${foods.allergenType} is not null`
  );
}

// Categories covered for a child, excluding the `autre` bucket so this count
// shares a denominator with the dashboard's totalCategories (CATEGORIES.length - 1).
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
  priorTypes: Set<string>; // allergen types already introduced, pre-insert
  priorAllergensIntroduced: number; // = priorTypes.size, kept for readability
};

// Snapshot pre-insert state so milestones (first food, first allergen(s),
// all-allergens, category progress) can be detected once the repas rows are
// inserted. priorTypes MUST be read here, before any insert in this
// transaction: querying allergen types after the insert loop would include the
// repas's own just-inserted rows, so every "first allergen" would look
// already-seen and the celebration would never fire.
export function milestoneBaseline(tx: Tx, childId: number): MilestoneBaseline {
  const priorEntryCount = countOf(
    tx
      .select({ n: sql<number>`count(*)` })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
      .limit(1)
      .all()
  );

  const priorTypes = new Set(
    tx
      .select({ t: foods.allergenType })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(toleratedAllergenExposure(childId))
      .all()
      .map((r) => r.t as string)
  );

  return {
    priorEntryCount,
    priorCategoriesCovered: countCategoriesCovered(tx, childId),
    priorTypes,
    priorAllergensIntroduced: priorTypes.size
  };
}

// Distinct allergen types introduced for this child, post-insert. Paired with
// the pre-insert snapshot's priorAllergensIntroduced, this detects a repas
// crossing the "all 12 allergens" finish line even when it introduces more
// than one new type at once.
function distinctAllergensIntroduced(tx: Tx, childId: number): number {
  return countOf(
    tx
      .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(toleratedAllergenExposure(childId))
      .limit(1)
      .all()
  );
}

// This repas's milestones, set-based across every aliment (not just the
// first). Call after the rows are inserted, with the baseline taken before.
export function measureMilestones(
  tx: Tx,
  childId: number,
  aliments: Aliment[],
  baseline: MilestoneBaseline,
  tolerated: boolean
): Milestones {
  const afterDistinct = distinctAllergensIntroduced(tx, childId); // post-insert
  const mealTypes = aliments
    .filter((food) => countsAsAllergenExposure(food))
    .map((food) => food.allergenType as string);
  const newTypes = tolerated ? mealTypes.filter((t) => !baseline.priorTypes.has(t)) : [];
  // Celebrate only allergens for which the app actually recommends prompt
  // introduction; the wider 12-item EU tracking list includes soja and
  // allergens with no preventive introduction calendar.
  const firstAllergen = PRIORITY_INTRODUCTION_ALLERGENS.find((id) => newTypes.includes(id)) ?? null;

  return {
    firstFood: baseline.priorEntryCount === 0,
    firstAllergen,
    allAllergens:
      afterDistinct === ALLERGENS.length && baseline.priorAllergensIntroduced < ALLERGENS.length,
    categories: {
      before: baseline.priorCategoriesCovered,
      after: countCategoriesCovered(tx, childId)
    }
  };
}

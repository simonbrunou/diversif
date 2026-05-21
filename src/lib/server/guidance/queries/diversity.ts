// Diversity metrics, repeat-exposure candidates, weekly recap.

import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { CategoryId } from '$lib/utils/categories';
import { REPEAT_CANDIDATE_MAX_COUNT, REPEAT_CANDIDATE_MAX_WORST_RANK } from '../repeat-candidates';
import { loadTexturesTried } from './seasonal';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DiversityMetrics = {
  categoriesCovered: number;
  totalCategories: number;
  lastNewFoodAt: number | null;
  repeatExposureCount: number;
  texturesTried: number;
};

export async function loadDiversityMetrics(
  childId: number,
  totalCategories: number
): Promise<DiversityMetrics> {
  // Exclude 'autre' so the numerator matches the denominator the dashboard
  // passes (CATEGORIES.length - 1). Otherwise an `autre` log would push
  // categoriesCovered above totalCategories.
  const distinctRes = await db.execute<{ count: string }>(
    sql`SELECT COUNT(DISTINCT ${foods.category})::text as count
        FROM ${foodEntries}
        INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
        WHERE ${foodEntries.childId} = ${childId}
          AND ${foods.category} != 'autre'`
  );
  /* v8 ignore next : pg COUNT(*) always returns a single row */
  const distinctCategories = Number(distinctRes.rows[0]?.count ?? 0);

  // For each food, take the timestamp of its FIRST appearance (introduction).
  // We want the most recent of those, i.e. when the latest "new food" event
  // happened. MAX-of-grouped-MINs expresses this directly without the
  // accidental ORDER BY/LIMIT 1/outer MIN dance we used to do.
  const lastNewFoodRes = await db.execute<{ given_at: Date | null }>(
    sql`SELECT MAX(first_given_at) as given_at
        FROM (
          SELECT MIN(${foodEntries.givenAt}) as first_given_at
          FROM ${foodEntries}
          WHERE ${foodEntries.childId} = ${childId}
          GROUP BY ${foodEntries.foodId}
        ) firsts`
  );
  const lastNewFoodRow = lastNewFoodRes.rows[0];
  const lastNewFoodAt =
    lastNewFoodRow?.given_at != null ? new Date(lastNewFoodRow.given_at).getTime() : null;

  // Foods given 1–2 times whose worst reaction is 'ras' or 'inconfort'.
  // Predicate (n <= REPEAT_CANDIDATE_MAX_COUNT && worst <= REPEAT_CANDIDATE_MAX_WORST_RANK)
  // matches findRepeatCandidates in ../repeat-candidates (the SQL CASE WHEN
  // mirrors REACTION_RANK there). Wrapping WHERE rather than HAVING : pg-mem
  // can't traverse a HAVING clause that contains MAX(CASE ... END), and the
  // rewrite is also friendlier to query planners.
  const repeatRes = await db.execute<{ food_id: number; n: number; worst: number }>(
    sql`SELECT food_id, n, worst FROM (
          SELECT ${foodEntries.foodId} as food_id,
                 COUNT(*)::int as n,
                 MAX(CASE ${foodEntries.reaction}
                       WHEN 'reaction' THEN 2
                       WHEN 'inconfort' THEN 1
                       ELSE 0 END) as worst
          FROM ${foodEntries}
          WHERE ${foodEntries.childId} = ${childId}
          GROUP BY ${foodEntries.foodId}
        ) sub
        WHERE n <= ${REPEAT_CANDIDATE_MAX_COUNT} AND worst <= ${REPEAT_CANDIDATE_MAX_WORST_RANK}`
  );
  const repeatExposureCount = repeatRes.rows.length;

  const texturesTried = await loadTexturesTried(childId);

  return {
    categoriesCovered: distinctCategories,
    totalCategories,
    lastNewFoodAt,
    repeatExposureCount,
    texturesTried
  };
}

export type RepeatCandidate = {
  foodId: number;
  foodName: string;
  category: CategoryId;
  count: number;
  lastGivenAt: number;
};

/**
 * `limit` defaults to 5 as a sane top-N for any future short-list consumer;
 * pass `null` to disable the cap (e.g. the carnet `?repeat=1` filter, which
 * must return every candidate, not the oldest N). The dashboard "Reproposez"
 * cards take a separate JS path through findRepeatCandidates + reminders.ts
 * rule 6 (capped to 2 cards there), so they do not hit this default.
 * Predicate shares constants with findRepeatCandidates — see ../repeat-candidates.
 */
export async function loadRepeatCandidates(
  childId: number,
  limit: number | null = 5
): Promise<RepeatCandidate[]> {
  // Same wrapping-WHERE shape as loadDiversityMetrics' repeat query : see
  // comment there for why we don't use HAVING. LIMIT is conditionally
  // emitted because the carnet filter needs an uncapped list (ORDER BY
  // last_at ASC + a numeric cap would otherwise hide the most recently
  // re-offered foods past the first N rows on extremely active children).
  const limitClause = limit == null ? sql`` : sql`LIMIT ${limit}`;
  const res = await db.execute<{
    food_id: number;
    food_name: string;
    category: string;
    n: number;
    last_at: Date;
    worst: number;
  }>(
    sql`SELECT food_id, food_name, category, n, last_at, worst FROM (
          SELECT ${foodEntries.foodId} as food_id,
                 ${foods.name} as food_name,
                 ${foods.category} as category,
                 COUNT(*)::int as n,
                 MAX(${foodEntries.givenAt}) as last_at,
                 MAX(CASE ${foodEntries.reaction}
                       WHEN 'reaction' THEN 2
                       WHEN 'inconfort' THEN 1
                       ELSE 0 END) as worst
          FROM ${foodEntries}
          INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
          WHERE ${foodEntries.childId} = ${childId}
          GROUP BY ${foodEntries.foodId}, ${foods.name}, ${foods.category}
        ) sub
        WHERE n <= ${REPEAT_CANDIDATE_MAX_COUNT} AND worst <= ${REPEAT_CANDIDATE_MAX_WORST_RANK}
        ORDER BY last_at ASC
        ${limitClause}`
  );
  return res.rows.map((r) => ({
    foodId: Number(r.food_id),
    foodName: r.food_name,
    category: r.category as CategoryId,
    count: Number(r.n),
    lastGivenAt: new Date(r.last_at).getTime()
  }));
}

export type WeeklyRecap = {
  /** Total entries in the past 7 days */
  entries: number;
  /** Distinct foods appearing for the FIRST time for this child in the past 7 days */
  newFoods: number;
  /** Distinct allergen types appearing for the FIRST time for this child in the past 7 days */
  newAllergens: number;
};

export async function loadWeeklyRecap(
  childId: number,
  now: Date = new Date()
): Promise<WeeklyRecap> {
  const since = new Date(now.getTime() - 7 * DAY_MS);

  const entriesRes = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
          AND ${foodEntries.givenAt} >= ${since}`
  );
  /* v8 ignore next : pg COUNT(*) always returns a single row */
  const entries = Number(entriesRes.rows[0]?.count ?? 0);

  // First-ever appearance per food, kept only if that first appearance is in
  // the window. Wrap with WHERE rather than HAVING so pg-mem can plan it.
  const newFoodsRes = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count FROM (
          SELECT ${foodEntries.foodId} as food_id, MIN(${foodEntries.givenAt}) as first_at
          FROM ${foodEntries}
          WHERE ${foodEntries.childId} = ${childId}
          GROUP BY ${foodEntries.foodId}
        ) firsts
        WHERE first_at >= ${since}`
  );
  /* v8 ignore next : pg COUNT(*) always returns a single row */
  const newFoods = Number(newFoodsRes.rows[0]?.count ?? 0);

  // First-ever appearance per allergenType, restricted to non-null allergens.
  const newAllergensRes = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count FROM (
          SELECT ${foods.allergenType} as allergen_type, MIN(${foodEntries.givenAt}) as first_at
          FROM ${foodEntries}
          INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
          WHERE ${foodEntries.childId} = ${childId}
            AND ${foods.allergenType} IS NOT NULL
          GROUP BY ${foods.allergenType}
        ) firsts
        WHERE first_at >= ${since}`
  );
  /* v8 ignore next : pg COUNT(*) always returns a single row */
  const newAllergens = Number(newAllergensRes.rows[0]?.count ?? 0);

  return { entries, newFoods, newAllergens };
}

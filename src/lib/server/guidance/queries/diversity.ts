// Repeat-exposure candidates. (The file name predates the removal of the
// dashboard diversity metrics, #424.)

import { db } from '#lib/server/db/index.js';
import { execRows } from '#lib/server/db/exec.js';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { sql } from 'drizzle-orm';
import type { CategoryId } from '#lib/utils/categories.js';
import { REPEAT_CANDIDATE_MAX_COUNT, REPEAT_CANDIDATE_MAX_WORST_RANK } from '../repeat-candidates';

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
 * ruleRepeatExposure (capped to 2 cards there), so they do not hit this default.
 * Predicate shares constants with findRepeatCandidates — see ../repeat-candidates.
 */
export async function loadRepeatCandidates(
  childId: number,
  limit: number | null = 5
): Promise<RepeatCandidate[]> {
  // The CASE WHEN mirrors REACTION_RANK (#lib/utils/reaction-values) by hand:
  // update both if a reaction value is added (the reaction CHECK constraint
  // means ELSE only ever sees 'ras'). The outer WHERE on n/worst, rather than
  // HAVING, is a leftover shape that SQLite treats the same. LIMIT is conditionally
  // emitted because the carnet filter needs an uncapped list (ORDER BY
  // last_at ASC + a numeric cap would otherwise hide the most recently
  // re-offered foods past the first N rows on extremely active children).
  const limitClause = limit == null ? sql`` : sql`LIMIT ${limit}`;
  const rows = await execRows<{
    food_id: number;
    food_name: string;
    category: string;
    n: number;
    last_at: Date | string;
    worst: number;
  }>(
    db,
    sql`SELECT food_id, food_name, category, n, last_at, worst FROM (
          SELECT ${foodEntries.foodId} as food_id,
                 ${foods.name} as food_name,
                 ${foods.category} as category,
                 COUNT(*) as n,
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
  return rows.map((r) => ({
    foodId: Number(r.food_id),
    foodName: r.food_name,
    category: r.category as CategoryId,
    count: Number(r.n),
    lastGivenAt: new Date(r.last_at).getTime()
  }));
}

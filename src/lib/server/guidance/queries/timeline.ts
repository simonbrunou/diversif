// Timeline-oriented queries: streak and co-parent activity.

import { db } from '$lib/server/db';
import { execRows } from '$lib/server/db/exec';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, asc, desc, eq, gte, ne, sql } from 'drizzle-orm';
import type { CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';

const DAY_MS = 24 * 60 * 60 * 1000;

export type EnrichedEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  allergenType: string | null;
  reaction: ReactionId;
  givenAt: number;
};

/**
 * Current consecutive-day streak and the all-time longest one.
 *
 * Both come out of the SAME query : it already returns every distinct logging
 * day in descending order, so the record is a second pass over rows we have
 * in hand rather than a second round-trip. Before this, the dashboard passed
 * `streak` as its own `streakRecord`, which made "record" unconditionally
 * true for any streak >= 1 and told a first-timer that one day was her best.
 */
export type StreakStats = { current: number; record: number };

export async function loadStreak(childId: number, now: Date = new Date()): Promise<StreakStats> {
  // We bucket by UTC day on purpose. Most parents are within UTC±2 (Europe),
  // and a UTC-day boundary differs from local-day by at most ~2 hours : well
  // outside the normal awake window for logging baby meals (basically nobody
  // logs lunch at 02:00 local). The cost of UTC-bucketing is a theoretical
  // off-by-one for someone logging right around midnight in a far-east
  // timezone; the benefit is a stable computation that doesn't depend on the
  // server's TZ env or a costly per-row TZ shift. If we ever start serving
  // users far from Europe, switch to a localized bucketing here.
  // Distinct UTC days that contain at least one entry, in descending order.
  const res = await execRows<{ day: string }>(
    db,
    // givenAt is stored as integer epoch-ms; integer division by DAY_MS yields
    // the UTC day index directly (no EXTRACT(EPOCH)/FLOOR needed). SQLite's `/`
    // on two integers truncates, which equals floor for non-negative epochs.
    sql`SELECT DISTINCT ${foodEntries.givenAt} / ${sql.raw(String(DAY_MS))} as day
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
        ORDER BY day DESC`
  );
  const days = res.map((r) => Number(r.day));
  if (days.length === 0) return { current: 0, record: 0 };

  // Longest run of consecutive days anywhere in the history. `days` is
  // DISTINCT and descending, so a run breaks the moment the gap to the next
  // day is not exactly 1.
  let record = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1] - 1 ? run + 1 : 1;
    if (run > record) record = run;
  }

  const today = Math.floor(now.getTime() / DAY_MS);
  let cursor = today;
  // Allow the streak to start "yesterday" if the user has not logged today yet.
  if (days[0] !== today) {
    if (days[0] === today - 1) {
      cursor = today - 1;
    } else {
      // No current streak, but the record still stands.
      return { current: 0, record };
    }
  }

  let current = 0;
  for (const day of days) {
    if (day === cursor) {
      current += 1;
      cursor -= 1;
    } else if (day < cursor) {
      break;
    }
  }
  return { current, record };
}

export type CoparentEntry = {
  id: number;
  foodName: string;
  category: CategoryId;
  reaction: ReactionId;
  givenAt: number;
  loggedByName: string;
  mealId: string | null;
};

/**
 * Recent food entries on this child logged by someone OTHER than the current
 * viewer, within the last `days`. Used to power a "your co-parent has been
 * busy" card on the dashboard. Empty for solo accounts.
 */
export async function loadCoparentActivity(
  childId: number,
  currentUserId: number,
  days: number = 7,
  limit: number = 5
): Promise<CoparentEntry[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db
    .select({
      id: foodEntries.id,
      foodName: foods.name,
      category: foods.category,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt,
      loggedByName: users.displayName,
      mealId: foodEntries.mealId
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .innerJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(
      and(
        eq(foodEntries.childId, childId),
        ne(foodEntries.loggedBy, currentUserId),
        gte(foodEntries.givenAt, since)
      )
    )
    // Secondary `asc(id)` tiebreaker (same contract as the dashboard `recent`
    // query, Task 3): a multi-ingredient meal's rows share the same givenAt,
    // so without a deterministic tiebreaker their relative order — and thus
    // adjacency once run through groupByMeal — would be unspecified. Do NOT
    // drop the primary `desc(givenAt)` sort; this is additive only.
    .orderBy(desc(foodEntries.givenAt), asc(foodEntries.id))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    foodName: r.foodName,
    category: r.category as CategoryId,
    reaction: r.reaction as ReactionId,
    givenAt: r.givenAt.getTime(),
    loggedByName: r.loggedByName,
    mealId: r.mealId
  }));
}

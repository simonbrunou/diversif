// Timeline-oriented queries: recent entries, streak, co-parent activity,
// rolling analytics buckets.

import { db } from '$lib/server/db';
import { execRows } from '$lib/server/db/exec';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
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

export async function loadRecentEntries(childId: number, days: number): Promise<EnrichedEntry[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db
    .select({
      id: foodEntries.id,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), gte(foodEntries.givenAt, since)))
    .orderBy(desc(foodEntries.givenAt));
  return rows.map((r) => ({
    id: r.id,
    foodId: r.foodId,
    foodName: r.foodName,
    category: r.category as CategoryId,
    allergenType: r.allergenType,
    reaction: r.reaction as ReactionId,
    givenAt: r.givenAt.getTime()
  }));
}

export async function loadStreak(childId: number, now: Date = new Date()): Promise<number> {
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
    sql`SELECT DISTINCT FLOOR(EXTRACT(EPOCH FROM ${foodEntries.givenAt}) / ${sql.raw(String(DAY_MS / 1000))})::bigint::text as day
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
        ORDER BY day DESC`
  );
  const rows = res.map((r) => ({ day: Number(r.day) }));
  if (rows.length === 0) return 0;

  const today = Math.floor(now.getTime() / DAY_MS);
  let cursor = today;
  // Allow the streak to start "yesterday" if the user has not logged today yet.
  if (rows[0].day !== today) {
    if (rows[0].day === today - 1) {
      cursor = today - 1;
    } else {
      return 0;
    }
  }

  let streak = 0;
  for (const r of rows) {
    if (r.day === cursor) {
      streak += 1;
      cursor -= 1;
    } else if (r.day < cursor) {
      break;
    }
  }
  return streak;
}

export type CoparentEntry = {
  id: number;
  foodName: string;
  category: CategoryId;
  reaction: ReactionId;
  givenAt: number;
  loggedByName: string;
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
      loggedByName: users.displayName
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
    .orderBy(desc(foodEntries.givenAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    foodName: r.foodName,
    category: r.category as CategoryId,
    reaction: r.reaction as ReactionId,
    givenAt: r.givenAt.getTime(),
    loggedByName: r.loggedByName
  }));
}

export type WeekBucket = {
  /** Inclusive UTC start of the bucket, ms. */
  weekStart: number;
  /** Distinct foods first introduced in this bucket. */
  introductions: number;
  /** Reaction counts for entries within this bucket. */
  reactions: { ras: number; inconfort: number; reaction: number };
  /** Distinct categories covered through the END of this bucket (excluding 'autre'). */
  cumulativeCategories: number;
};

/**
 * Build N rolling 7-day buckets ending "now". The most recent bucket is
 * [now - 7d, now); index 0 in the returned array is the OLDEST bucket so
 * charts read left-to-right chronologically.
 */
export async function loadAnalyticsBuckets(
  childId: number,
  weeks: number = 12,
  now: Date = new Date()
): Promise<WeekBucket[]> {
  const horizonMs = now.getTime() - weeks * 7 * DAY_MS;
  const horizon = new Date(horizonMs);

  // Per-food first-introduction timestamps + category. One row per distinct
  // food the child has ever eaten : typically 50-200 rows even for an
  // active child. Powers BOTH "introductions in bucket" (first_at in window)
  // and "cumulative categories through bucket end" (categories whose first
  // intro was before window end). We need history older than horizonMs for
  // cumulative correctness, but it's a tiny rollup, not the full entry log.
  const introRows = await db
    .select({
      foodId: foods.id,
      category: foods.category,
      firstAt: sql<Date>`MIN(${foodEntries.givenAt})`.as('first_at')
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId))
    .groupBy(foods.id, foods.category);

  // In-horizon entry rows for reaction counts. Cap the scan at the chart
  // window so years-of-history children don't drag the dashboard down.
  const horizonRows = await db
    .select({
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), gte(foodEntries.givenAt, horizon)));

  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now.getTime() - (i + 1) * 7 * DAY_MS;
    const end = now.getTime() - i * 7 * DAY_MS;
    let introductions = 0;
    let ras = 0;
    let inconfort = 0;
    let reaction = 0;
    const cumulativeCategorySet = new Set<string>();
    for (const r of introRows) {
      const firstAt = new Date(r.firstAt).getTime();
      if (firstAt < end && r.category !== 'autre') cumulativeCategorySet.add(r.category);
      if (firstAt >= start && firstAt < end) introductions += 1;
    }
    for (const r of horizonRows) {
      const ts = r.givenAt.getTime();
      if (ts >= start && ts < end) {
        if (r.reaction === 'ras') ras += 1;
        else if (r.reaction === 'inconfort') inconfort += 1;
        else if (r.reaction === 'reaction') reaction += 1;
      }
    }
    buckets.push({
      weekStart: Math.max(start, horizonMs),
      introductions,
      reactions: { ras, inconfort, reaction },
      cumulativeCategories: cumulativeCategorySet.size
    });
  }
  return buckets;
}

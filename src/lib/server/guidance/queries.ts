// Server-side aggregations supporting the guidance UI: diversity metrics,
// repeat-exposure candidates, dismissal lookups. Pure SQL via Drizzle.

import { db } from '$lib/server/db';
import { foodEntries, foods, tipDismissals } from '$lib/server/db/schema';
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
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

export function loadRecentEntries(childId: number, days: number): EnrichedEntry[] {
  const since = new Date(Date.now() - days * DAY_MS);
  return db
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
    .orderBy(desc(foodEntries.givenAt))
    .all()
    .map((r) => ({
      id: r.id,
      foodId: r.foodId,
      foodName: r.foodName,
      category: r.category as CategoryId,
      allergenType: r.allergenType,
      reaction: r.reaction as ReactionId,
      // Drizzle's timestamp_ms mode always materializes givenAt as a Date.
      givenAt: r.givenAt.getTime()
    }));
}

export type DiversityMetrics = {
  categoriesCovered: number;
  totalCategories: number;
  lastNewFoodAt: number | null;
  repeatExposureCount: number;
};

export function loadDiversityMetrics(childId: number, totalCategories: number): DiversityMetrics {
  // Exclude 'autre' so the numerator matches the denominator the dashboard
  // passes (CATEGORIES.length - 1). Otherwise an `autre` log would push
  // categoriesCovered above totalCategories.
  const distinctCategories =
    db.get<{ count: number }>(
      sql`SELECT COUNT(DISTINCT ${foods.category}) as count
          FROM ${foodEntries}
          INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
          WHERE ${foodEntries.childId} = ${childId}
            AND ${foods.category} != 'autre'`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  const lastNewFood = db.get<{ given_at: number }>(
    sql`SELECT MIN(given_at) as given_at
        FROM (
          SELECT ${foodEntries.foodId} as food_id, MIN(${foodEntries.givenAt}) as given_at
          FROM ${foodEntries}
          WHERE ${foodEntries.childId} = ${childId}
          GROUP BY ${foodEntries.foodId}
          ORDER BY given_at DESC
          LIMIT 1
        )`
  );
  const lastNewFoodAt = lastNewFood?.given_at != null ? Number(lastNewFood.given_at) : null;

  // Foods given 1–2 times whose worst reaction is 'ras' or 'inconfort'
  const repeatRows = db.all<{ food_id: number; n: number; worst: string }>(
    sql`SELECT ${foodEntries.foodId} as food_id,
               COUNT(*) as n,
               MAX(CASE ${foodEntries.reaction}
                     WHEN 'reaction' THEN 2
                     WHEN 'inconfort' THEN 1
                     ELSE 0 END) as worst
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
        GROUP BY ${foodEntries.foodId}
        HAVING n <= 2 AND worst <= 1`
  );
  const repeatExposureCount = repeatRows.length;

  return {
    categoriesCovered: distinctCategories,
    totalCategories,
    lastNewFoodAt,
    repeatExposureCount
  };
}

export type RepeatCandidate = {
  foodId: number;
  foodName: string;
  category: CategoryId;
  count: number;
  lastGivenAt: number;
};

export function loadRepeatCandidates(childId: number, limit = 5): RepeatCandidate[] {
  return db
    .all<{
      food_id: number;
      food_name: string;
      category: string;
      n: number;
      last_at: number;
      worst: number;
    }>(
      sql`SELECT ${foodEntries.foodId} as food_id,
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
          GROUP BY ${foodEntries.foodId}
          HAVING n <= 2 AND worst <= 1
          ORDER BY last_at ASC
          LIMIT ${limit}`
    )
    .map((r) => ({
      foodId: Number(r.food_id),
      foodName: r.food_name,
      category: r.category as CategoryId,
      count: Number(r.n),
      lastGivenAt: Number(r.last_at)
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

export function loadWeeklyRecap(childId: number, now: Date = new Date()): WeeklyRecap {
  const sinceMs = now.getTime() - 7 * DAY_MS;

  const entries =
    db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count
          FROM ${foodEntries}
          WHERE ${foodEntries.childId} = ${childId}
            AND ${foodEntries.givenAt} >= ${sinceMs}`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  // First-ever appearance per food, kept only if that first appearance is in the window.
  const newFoods =
    db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM (
            SELECT ${foodEntries.foodId} as food_id, MIN(${foodEntries.givenAt}) as first_at
            FROM ${foodEntries}
            WHERE ${foodEntries.childId} = ${childId}
            GROUP BY ${foodEntries.foodId}
            HAVING first_at >= ${sinceMs}
          )`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  // First-ever appearance per allergenType, restricted to non-null allergens.
  const newAllergens =
    db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM (
            SELECT ${foods.allergenType} as allergen_type, MIN(${foodEntries.givenAt}) as first_at
            FROM ${foodEntries}
            INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
            WHERE ${foodEntries.childId} = ${childId}
              AND ${foods.allergenType} IS NOT NULL
            GROUP BY ${foods.allergenType}
            HAVING first_at >= ${sinceMs}
          )`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  return { entries, newFoods, newAllergens };
}

export function loadStreak(childId: number, now: Date = new Date()): number {
  // Distinct UTC days that contain at least one entry, in descending order.
  const rows = db.all<{ day: number }>(
    sql`SELECT DISTINCT CAST((${foodEntries.givenAt} / ${DAY_MS}) AS INTEGER) as day
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
        ORDER BY day DESC`
  );
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
export function loadAnalyticsBuckets(
  childId: number,
  weeks: number = 12,
  now: Date = new Date()
): WeekBucket[] {
  const horizonMs = now.getTime() - weeks * 7 * DAY_MS;

  // Pull the data we need once; bucketing happens in JS for clarity.
  const rows = db
    .select({
      foodId: foods.id,
      category: foods.category,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId))
    .orderBy(asc(foodEntries.givenAt))
    .all();

  // Per-row precomputation: which rows are first-introductions for their
  // food, and the running cumulative-category count after each row. Walking
  // the rows once here means the per-bucket loop below is a simple range
  // filter without re-doing this work.
  const introRowIdx = new Set<number>();
  const seenFoodIds = new Set<number>();
  const seenCategories = new Set<string>();
  const runningCatSize: number[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (!seenFoodIds.has(r.foodId)) {
      seenFoodIds.add(r.foodId);
      introRowIdx.add(idx);
    }
    if (r.category !== 'autre') seenCategories.add(r.category);
    runningCatSize.push(seenCategories.size);
  }

  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now.getTime() - (i + 1) * 7 * DAY_MS;
    const end = now.getTime() - i * 7 * DAY_MS;
    let introductions = 0;
    let ras = 0;
    let inconfort = 0;
    let reaction = 0;
    let cumulativeCategories = 0;
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const ts = r.givenAt.getTime();
      if (ts < end) cumulativeCategories = runningCatSize[idx];
      if (ts >= start && ts < end) {
        if (r.reaction === 'ras') ras += 1;
        else if (r.reaction === 'inconfort') inconfort += 1;
        else if (r.reaction === 'reaction') reaction += 1;
        if (introRowIdx.has(idx)) introductions += 1;
      }
    }
    buckets.push({
      weekStart: Math.max(start, horizonMs),
      introductions,
      reactions: { ras, inconfort, reaction },
      cumulativeCategories
    });
  }
  return buckets;
}

export function loadDismissals(userId: number, childId: number): Set<string> {
  const rows = db
    .select({ key: tipDismissals.reminderKey, at: tipDismissals.dismissedAt })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), eq(tipDismissals.childId, childId)))
    .all();
  // Honor TTL by reminderKey prefix (info: 30d, warn: 90d, important: never)
  const now = Date.now();
  const out = new Set<string>();
  for (const r of rows) {
    const at = r.at.getTime();
    const ttl = ttlForReminderKey(r.key);
    if (ttl == null || now - at < ttl) {
      out.add(r.key);
    }
  }
  return out;
}

function ttlForReminderKey(key: string): number | null {
  // Conventions:
  //   important reminders are 'welcome', 'stage-transition:*', 'forbidden-reminder:*' → no TTL until conditions clear
  //   warn reminders are 'pending-allergen:*', 'high-risk-window' → 90 days
  //   info reminders are everything else → 30 days
  if (
    key === 'welcome' ||
    key === 'welcome-dialog' ||
    key.startsWith('stage-transition:') ||
    key.startsWith('forbidden-reminder:')
  ) {
    return null;
  }
  if (key.startsWith('pending-allergen:') || key === 'high-risk-window') {
    return 90 * DAY_MS;
  }
  return 30 * DAY_MS;
}

export function dismissReminder(userId: number, childId: number, key: string): void {
  db.insert(tipDismissals)
    .values({ userId, childId, reminderKey: key, dismissedAt: new Date() })
    .onConflictDoUpdate({
      target: [tipDismissals.userId, tipDismissals.childId, tipDismissals.reminderKey],
      set: { dismissedAt: new Date() }
    })
    .run();
}

// Server-side aggregations supporting the guidance UI: diversity metrics,
// repeat-exposure candidates, dismissal lookups. Pure SQL via Drizzle.

import { db } from '$lib/server/db';
import { foodEntries, foods, tipDismissals, users } from '$lib/server/db/schema';
import { and, desc, eq, gte, ne, sql } from 'drizzle-orm';
import type { CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';
import { REPEAT_CANDIDATE_MAX_COUNT, REPEAT_CANDIDATE_MAX_WORST_RANK } from './repeat-candidates';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadTexturesTried(childId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(distinct ${foodEntries.texture})::int` })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`))
    .limit(1);
  /* v8 ignore next : COUNT() always returns a row */
  return rows[0]?.n ?? 0;
}

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
  // matches findRepeatCandidates in ./repeat-candidates (the SQL CASE WHEN
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
 * Predicate shares constants with findRepeatCandidates — see ./repeat-candidates.
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
  const res = await db.execute<{ day: string }>(
    sql`SELECT DISTINCT FLOOR(EXTRACT(EPOCH FROM ${foodEntries.givenAt}) / ${sql.raw(String(DAY_MS / 1000))})::bigint::text as day
        FROM ${foodEntries}
        WHERE ${foodEntries.childId} = ${childId}
        ORDER BY day DESC`
  );
  const rows = res.rows.map((r) => ({ day: Number(r.day) }));
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

export async function loadDismissals(userId: number, childId: number): Promise<Set<string>> {
  const rows = await db
    .select({ key: tipDismissals.reminderKey, at: tipDismissals.dismissedAt })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), eq(tipDismissals.childId, childId)));
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

export async function dismissReminder(userId: number, childId: number, key: string): Promise<void> {
  await db
    .insert(tipDismissals)
    .values({ userId, childId, reminderKey: key, dismissedAt: new Date() })
    .onConflictDoUpdate({
      target: [tipDismissals.userId, tipDismissals.childId, tipDismissals.reminderKey],
      set: { dismissedAt: new Date() }
    });
}

// Server-side aggregations supporting the guidance UI: diversity metrics,
// repeat-exposure candidates, dismissal lookups. Pure SQL via Drizzle.

import { db } from '$lib/server/db';
import { foodEntries, foods, tipDismissals } from '$lib/server/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
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
      givenAt: r.givenAt instanceof Date ? r.givenAt.getTime() : Number(r.givenAt)
    }));
}

export type DiversityMetrics = {
  categoriesCovered: number;
  totalCategories: number;
  lastNewFoodAt: number | null;
  repeatExposureCount: number;
};

export function loadDiversityMetrics(childId: number, totalCategories: number): DiversityMetrics {
  const distinctCategories =
    db.get<{ count: number }>(
      sql`SELECT COUNT(DISTINCT ${foods.category}) as count
          FROM ${foodEntries}
          INNER JOIN ${foods} ON ${foods.id} = ${foodEntries.foodId}
          WHERE ${foodEntries.childId} = ${childId}`
    )?.count ?? 0;

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
    const at = r.at instanceof Date ? r.at.getTime() : Number(r.at);
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

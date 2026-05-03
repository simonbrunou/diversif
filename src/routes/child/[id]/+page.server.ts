import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { desc, eq, sql, and, isNotNull } from 'drizzle-orm';
import { ALLERGENS } from '$lib/utils/allergens';
import type { PageServerLoad } from './$types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type AllergenSummary = {
  introduced: number;
  total: number;
  ras: number;
  inconfort: number;
  reaction: number;
};

export const load: PageServerLoad = async ({ params }) => {
  const childId = Number(params.id);
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const recent = db
    .select({
      id: foodEntries.id,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      notes: foodEntries.notes,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .innerJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(eq(foodEntries.childId, childId))
    .orderBy(desc(foodEntries.givenAt))
    .limit(20)
    .all();

  const distinctFoods =
    db.get<{ count: number }>(
      sql`SELECT COUNT(DISTINCT food_id) as count FROM food_entries WHERE child_id = ${childId}`
    )?.count ?? 0;

  const weekCount =
    db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM food_entries WHERE child_id = ${childId} AND given_at >= ${sevenDaysAgo.getTime()}`
    )?.count ?? 0;

  const allergenRows = db
    .select({
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
    .all();

  const worstByAllergen = new Map<string, 'ras' | 'inconfort' | 'reaction'>();
  for (const r of allergenRows) {
    if (!r.allergenType) continue;
    const cur = worstByAllergen.get(r.allergenType);
    const next = r.reaction as 'ras' | 'inconfort' | 'reaction';
    if (!cur) {
      worstByAllergen.set(r.allergenType, next);
    } else {
      const rank = { ras: 0, inconfort: 1, reaction: 2 } as const;
      if (rank[next] > rank[cur]) worstByAllergen.set(r.allergenType, next);
    }
  }

  const summary: AllergenSummary = {
    introduced: worstByAllergen.size,
    total: ALLERGENS.length,
    ras: 0,
    inconfort: 0,
    reaction: 0
  };
  for (const v of worstByAllergen.values()) summary[v] += 1;

  return {
    recent: recent.map((r) => ({
      ...r,
      givenAt: r.givenAt instanceof Date ? r.givenAt.getTime() : Number(r.givenAt)
    })),
    stats: {
      foodsIntroduced: distinctFoods,
      weekCount,
      allergens: summary
    }
  };
};

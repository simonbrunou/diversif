import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { desc, eq, sql, and, isNotNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const childId = Number(params.id);

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
    .limit(10)
    .all();

  // Stats: distinct foods, distinct allergens introduced.
  const distinctFoods =
    db.get<{ count: number }>(
      sql`SELECT COUNT(DISTINCT food_id) as count FROM food_entries WHERE child_id = ${childId}`
    )?.count ?? 0;

  const distinctAllergens = db
    .selectDistinct({ allergenType: foods.allergenType })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
    .all();

  return {
    recent: recent.map((r) => ({
      ...r,
      givenAt: r.givenAt instanceof Date ? r.givenAt.getTime() : Number(r.givenAt)
    })),
    stats: {
      foodsIntroduced: distinctFoods,
      allergensIntroduced: distinctAllergens.filter((r) => r.allergenType !== null).length,
      allergensTotal: 12
    }
  };
};

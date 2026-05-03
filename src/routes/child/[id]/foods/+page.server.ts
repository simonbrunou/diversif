import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const childId = Number(params.id);

  const q = url.searchParams.get('q')?.trim() ?? '';
  const category = url.searchParams.get('category') ?? '';
  const reaction = url.searchParams.get('reaction') ?? '';
  const repeat = url.searchParams.get('repeat') === '1';

  const conditions = [eq(foodEntries.childId, childId)];
  if (category) conditions.push(eq(foods.category, category));
  if (reaction === 'ras' || reaction === 'inconfort' || reaction === 'reaction') {
    conditions.push(eq(foodEntries.reaction, reaction));
  }

  if (repeat) {
    // Foods given <= 2 times whose worst reaction is RAS or Inconfort (worth re-exposing).
    const repeatRows = db.all<{ food_id: number }>(
      sql`SELECT food_id FROM (
            SELECT ${foodEntries.foodId} AS food_id,
                   COUNT(*) AS n,
                   MAX(CASE ${foodEntries.reaction}
                         WHEN 'reaction' THEN 2
                         WHEN 'inconfort' THEN 1
                         ELSE 0 END) AS worst
            FROM ${foodEntries}
            WHERE ${foodEntries.childId} = ${childId}
            GROUP BY ${foodEntries.foodId}
          )
          WHERE n <= 2 AND worst <= 1`
    );
    const ids = repeatRows.map((r) => Number(r.food_id));
    if (ids.length === 0) {
      return {
        entries: [],
        filters: { q, category, reaction, repeat }
      };
    }
    conditions.push(inArray(foodEntries.foodId, ids));
  }

  let rows = db
    .select({
      id: foodEntries.id,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      notes: foodEntries.notes,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      isCustom: foods.isCustom,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .innerJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(and(...conditions))
    .orderBy(desc(foodEntries.givenAt))
    .limit(200)
    .all();

  if (q) {
    const { normalize } = await import('$lib/utils/search');
    const nq = normalize(q);
    rows = rows.filter((r) => normalize(r.foodName).includes(nq));
  }

  return {
    entries: rows.map((r) => ({
      ...r,
      givenAt:
        r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt)
    })),
    filters: { q, category, reaction, repeat }
  };
};

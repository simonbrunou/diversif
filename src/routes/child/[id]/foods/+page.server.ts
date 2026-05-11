import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { parseChildIdParam, requireMembership, requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
  requireUser(locals);
  const childId = parseChildIdParam(params);
  requireMembership(locals, childId);

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
    const repeatResult = await db.execute(
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
          ) sub
          WHERE n <= 2 AND worst <= 1`
    );
    const repeatRows = repeatResult.rows as Array<{ food_id: number }>;
    const ids = repeatRows.map((r) => Number(r.food_id));
    if (ids.length === 0) {
      return {
        entries: [],
        filters: { q, category, reaction, repeat },
        bentoFoods: [],
        foodCount: 0,
        categoryCount: 0
      };
    }
    conditions.push(inArray(foodEntries.foodId, ids));
  }

  let rows = await db
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
    .leftJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(and(...conditions))
    .orderBy(desc(foodEntries.givenAt))
    .limit(200);

  if (q) {
    const { normalize } = await import('$lib/utils/search');
    const nq = normalize(q);
    rows = rows.filter((r) => normalize(r.foodName).includes(nq));
  }

  // Rows are ordered DESC givenAt, so the first occurrence of each foodId is
  // the most recent entry — capture its id as `lastEntryId` so non-RAS food
  // cards can link to the reaction-detail page.
  const foodMap = new Map<
    number,
    {
      id: number;
      name: string;
      category: string;
      tried: number;
      status: 'ras' | 'inconfort' | 'reaction';
      lastEntryId: number;
    }
  >();
  const severity = { ras: 0, inconfort: 1, reaction: 2 } as const;
  for (const r of rows) {
    const reaction = r.reaction as 'ras' | 'inconfort' | 'reaction';
    const existing = foodMap.get(r.foodId);
    if (existing) {
      existing.tried += 1;
      if (severity[reaction] > severity[existing.status]) existing.status = reaction;
    } else {
      foodMap.set(r.foodId, {
        id: r.foodId,
        name: r.foodName,
        category: r.category,
        tried: 1,
        status: reaction,
        lastEntryId: r.id
      });
    }
  }
  const bentoFoods = Array.from(foodMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const foodCount = bentoFoods.length;
  const categoryCount = new Set(bentoFoods.map((f) => f.category)).size;

  return {
    entries: rows.map((r) => ({
      ...r,
      loggedByName: r.loggedByName ?? 'Compte supprimé',
      givenAt:
        r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt)
    })),
    filters: { q, category, reaction, repeat },
    bentoFoods,
    foodCount,
    categoryCount
  };
};

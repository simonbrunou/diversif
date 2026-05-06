import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, eq, isNotNull } from 'drizzle-orm';
import { ALLERGENS } from '$lib/utils/allergens';
import { parseChildIdParam, requireMembership, requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export type AllergenStatus = {
  id: string;
  label: string;
  introduced: boolean;
  firstIntroAt: number | null;
  lastIntroAt: number | null;
  count: number;
};

export const load: PageServerLoad = async ({ params, locals }) => {
  requireUser(locals);
  const childId = parseChildIdParam(params);
  requireMembership(locals, childId);

  const rows = db
    .select({
      allergenType: foods.allergenType,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
    .all();

  const acc = new Map<string, { count: number; first: number; last: number }>();
  for (const r of rows) {
    const id = r.allergenType;
    /* v8 ignore next — query already filters allergenType IS NOT NULL */
    if (!id) continue;
    const ts =
      r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt);
    const cur = acc.get(id);
    if (!cur) {
      acc.set(id, { count: 1, first: ts, last: ts });
    } else {
      cur.count += 1;
      cur.first = Math.min(cur.first, ts);
      cur.last = Math.max(cur.last, ts);
    }
  }

  const status: AllergenStatus[] = ALLERGENS.map((a) => {
    const stats = acc.get(a.id);
    return {
      id: a.id,
      label: a.label,
      introduced: !!stats,
      firstIntroAt: stats ? stats.first : null,
      lastIntroAt: stats ? stats.last : null,
      count: stats?.count ?? 0
    };
  });

  return { allergens: status };
};

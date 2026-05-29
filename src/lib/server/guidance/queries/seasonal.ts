// Seasonal-food lookup + texture-coverage queries.

import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getSeasonalNames } from '$lib/content/seasonal-foods';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SeasonalFood = {
  id: number;
  name: string;
  category: string;
  allergenType: string | null;
};

/**
 * Foods from the seasonal calendar for `month` (1-12) that are also
 * age-appropriate (`suggestedAgeMonths <= ageMonths`). Built-in seeded
 * foods only — custom per-child foods aren't included.
 */
export async function loadSeasonalFoods(ageMonths: number, month: number): Promise<SeasonalFood[]> {
  const names = getSeasonalNames(month);
  if (names.length === 0) return [];

  const rows = await db
    .select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      allergenType: foods.allergenType
    })
    .from(foods)
    .where(
      and(
        inArray(foods.name, names as string[]),
        eq(foods.isCustom, false),
        lte(foods.suggestedAgeMonths, ageMonths)
      )
    );

  // Preserve the order from the seasonal list so the most-iconic of the month
  // shows first; DB row order is otherwise undefined.
  const byName = new Map(rows.map((r) => [r.name, r]));
  return names.map((n) => byName.get(n)).filter((r): r is SeasonalFood => r != null);
}

export async function loadTexturesTried(childId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(distinct ${foodEntries.texture})` })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`))
    .limit(1);
  /* v8 ignore next : COUNT() always returns a row */
  return rows[0]?.n ?? 0;
}

export type TextureProgress = {
  /** Every distinct texture the child has ever been logged with. */
  tried: string[];
  /** Most recent texture seen in the past 30 days, or null if none. */
  mostRecent: string | null;
};

export async function loadTextureProgress(
  childId: number,
  now: Date = new Date()
): Promise<TextureProgress> {
  const since = new Date(now.getTime() - 30 * DAY_MS);

  const triedRows = await db
    .selectDistinct({ texture: foodEntries.texture })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`));
  const tried: string[] = [];
  for (const r of triedRows) {
    if (r.texture != null) tried.push(r.texture);
  }

  const recentRows = await db
    .select({ texture: foodEntries.texture, givenAt: foodEntries.givenAt })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.childId, childId),
        gte(foodEntries.givenAt, since),
        sql`${foodEntries.texture} IS NOT NULL`
      )
    )
    .orderBy(desc(foodEntries.givenAt))
    .limit(1);

  const mostRecent = recentRows[0]?.texture ?? null;

  return { tried, mostRecent };
}

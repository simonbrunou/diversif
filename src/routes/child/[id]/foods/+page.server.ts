import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { requireChildContext } from '$lib/server/guards';
import { loadRepeatCandidates, loadTexturesTried } from '$lib/server/guidance/queries';
import { loadAllergenStatus, type AllergenItem } from '$lib/server/guidance/allergen-status';
import type { TextureKey } from '$lib/utils/textures';
import type { PageServerLoad } from './$types';

export type { AllergenItem };

async function loadWeeklyEntries(
  childId: number,
  now: Date = new Date()
): Promise<{ counts: number[]; anchorUtc: number }> {
  // 7 daily buckets: oldest at index 0, today at index 6. Buckets are
  // UTC calendar days starting 6 days ago at 00:00 UTC through end-of-day today.
  // anchorUtc pins the "today" the buckets were computed against so the client
  // can label each bar against the same UTC date (and not drift if hydration
  // crosses a UTC midnight relative to render).
  const anchorUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const start = new Date(anchorUtc - 6 * 86400_000);
  const end = new Date(anchorUtc + 86400_000); // exclusive upper bound

  const rows = await db
    .select({ givenAt: foodEntries.givenAt })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.childId, childId),
        sql`${foodEntries.givenAt} >= ${start}`,
        sql`${foodEntries.givenAt} < ${end}`
      )
    );

  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const givenAt =
      r.givenAt instanceof Date ? r.givenAt : /* v8 ignore next */ new Date(Number(r.givenAt));
    const day = Date.UTC(
      givenAt.getUTCFullYear(),
      givenAt.getUTCMonth(),
      givenAt.getUTCDate(),
      0,
      0,
      0,
      0
    );
    const idx = Math.floor((day - start.getTime()) / 86400_000);
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  }
  return { counts, anchorUtc };
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const { childId } = requireChildContext(locals, params);

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
    // Foods given <= 2 times whose worst reaction is RAS or Inconfort. Shares
    // the threshold constants (and SQL form) with loadDiversityMetrics and the
    // dashboard "Reproposez" cards (which go through findRepeatCandidates in
    // reminders.ts rule 6) — see src/lib/server/guidance/repeat-candidates.
    // Pass `null` so the carnet filter returns every candidate, not the
    // oldest N (loadRepeatCandidates orders by last_at ASC before LIMIT).
    const candidates = await loadRepeatCandidates(childId, null);
    const ids = candidates.map((c) => c.foodId);
    if (ids.length === 0) {
      const [bentoAllergens, weeklyEntries, texturesTried] = await Promise.all([
        loadAllergenStatus(childId),
        loadWeeklyEntries(childId),
        loadTexturesTried(childId)
      ]);
      return {
        entries: [],
        filters: { q, category, reaction, repeat },
        bentoFoods: [],
        foodCount: 0,
        categoryCount: 0,
        texturesTried,
        bentoAllergens,
        weeklyEntries
      };
    }
    conditions.push(inArray(foodEntries.foodId, ids));
  }

  let rows = await db
    .select({
      id: foodEntries.id,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      texture: foodEntries.texture,
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
  // the most recent entry : capture its id as `lastEntryId` so non-RAS food
  // cards can link to the reaction-detail page.
  // Note: when a `?reaction=` filter is active, `lastEntryId` and `lastTexture`
  // reflect the most recent entry within the filter, not the absolute latest.
  const foodMap = new Map<
    number,
    {
      id: number;
      name: string;
      category: string;
      tried: number;
      status: 'ras' | 'inconfort' | 'reaction';
      lastEntryId: number;
      lastTexture: TextureKey | null;
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
        lastEntryId: r.id,
        lastTexture: r.texture ?? null
      });
    }
  }
  const bentoFoods = Array.from(foodMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const foodCount = bentoFoods.length;
  const categoryCount = new Set(bentoFoods.map((f) => f.category)).size;

  const [bentoAllergens, weeklyEntries, texturesTried] = await Promise.all([
    loadAllergenStatus(childId),
    loadWeeklyEntries(childId),
    loadTexturesTried(childId)
  ]);

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
    categoryCount,
    texturesTried,
    bentoAllergens,
    weeklyEntries
  };
};

import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { requireChildContext } from '$lib/server/guards';
import { toEpochMs } from '$lib/utils/dates';
import { parisDayIndex } from '$lib/utils/paris-date';
import { loadRepeatCandidates, loadTexturesTried } from '$lib/server/guidance/queries';
import { loadAllergenStatus } from '$lib/server/guidance/allergen-status';
import type { TextureKey } from '$lib/utils/textures';
import type { PageServerLoad } from './$types';

async function loadWeeklyEntries(
  childId: number,
  now: Date = new Date()
): Promise<{ counts: number[]; anchorUtc: number }> {
  // 7 daily buckets: oldest at index 0, today at index 6. Buckets are
  // Europe/Paris calendar days, so a food logged right after local midnight
  // lands in "today"'s bucket even though the server clock (and SQLite
  // storage) is UTC. anchorUtc pins the epoch-ms representation of today's
  // Paris dayIndex (see $lib/utils/paris-date) so the client can label each
  // bar against the same civil date without SSR/CSR hydration drift.
  const anchorIndex = parisDayIndex(now.getTime());
  const anchorUtc = anchorIndex * 86400_000;
  const startIndex = anchorIndex - 6;
  // SQL pre-filter only needs to be a superset: real Paris-midnight instants
  // can be up to ~2h off from the pseudo-UTC anchorUtc value, so pad a full
  // extra day on each side; exact bucketing below re-derives each row's
  // Paris civil day and is authoritative regardless of this margin.
  const start = new Date(anchorUtc - 7 * 86400_000);
  const end = new Date(anchorUtc + 2 * 86400_000);

  const rows = await db
    .select({ givenAt: foodEntries.givenAt })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.childId, childId),
        sql`${foodEntries.givenAt} >= ${start.getTime()}`,
        sql`${foodEntries.givenAt} < ${end.getTime()}`
      )
    );

  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const givenAtMs =
      r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt);
    const idx = parisDayIndex(givenAtMs) - startIndex;
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  }
  return { counts, anchorUtc };
}
type BentoFood = {
  id: number;
  name: string;
  category: string;
  tried: number;
  status: 'ras' | 'inconfort' | 'reaction';
  lastEntryId: number;
  lastTexture: TextureKey | null;
};

type BentoSourceRow = {
  id: number;
  foodId: number;
  foodName: string;
  category: string;
  reaction: 'ras' | 'inconfort' | 'reaction';
  texture: TextureKey | null;
};

// Base WHERE for the carnet query: always scoped to the child, plus the
// optional category / reaction facet filters.
function buildFoodFilters(childId: number, category: string, reaction: string) {
  const conditions = [eq(foodEntries.childId, childId)];
  if (category) conditions.push(eq(foods.category, category));
  if (reaction === 'ras' || reaction === 'inconfort' || reaction === 'reaction') {
    conditions.push(eq(foodEntries.reaction, reaction));
  }
  return conditions;
}

// Collapse the entry rows into one card per food (tried count + worst reaction),
// sorted alphabetically. Rows are ordered DESC givenAt, so the first occurrence
// of each foodId is the most recent entry : capture its id as `lastEntryId` so
// non-RAS food cards can link to the reaction-detail page.
// Note: when a `?reaction=` filter is active, `lastEntryId` and `lastTexture`
// reflect the most recent entry within the filter, not the absolute latest.
function aggregateBentoFoods(rows: BentoSourceRow[]): BentoFood[] {
  const foodMap = new Map<number, BentoFood>();
  const severity = { ras: 0, inconfort: 1, reaction: 2 } as const;
  for (const r of rows) {
    const reaction = r.reaction;
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
  return Array.from(foodMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Rendered per-entry history list is capped for page weight; the search
// filter, bento food/category aggregation, and their counts are computed
// from the *unbounded* row set (see load()) so a food logged earlier than
// this window is still found and counted correctly.
const MAX_RENDERED_ENTRIES = 200;

export const load: PageServerLoad = async ({ params, url, locals }) => {
  const { childId } = requireChildContext(locals, params);

  const q = url.searchParams.get('q')?.trim() ?? '';
  const category = url.searchParams.get('category') ?? '';
  const reaction = url.searchParams.get('reaction') ?? '';
  const repeat = url.searchParams.get('repeat') === '1';

  const conditions = buildFoodFilters(childId, category, reaction);

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

  // Unbounded on purpose: the LIMIT used to sit here, before the `q` text
  // filter ran in JS, so a food logged earlier than the 200 most recent
  // entries could never match a search and never counted toward
  // foodCount/categoryCount. SQLite's LIKE/LOWER can't reproduce
  // normalize()'s NFD diacritic-folding (no ICU/unicode61 collation
  // available in bun:sqlite), so the `q` filter stays in JS — it just now
  // runs over every matching row for this child instead of a truncated
  // window. Row count is bounded by one child's total entry history
  // (childId is indexed), not the whole table.
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
    .orderBy(desc(foodEntries.givenAt));

  if (q) {
    const { normalize } = await import('$lib/utils/search');
    const nq = normalize(q);
    rows = rows.filter((r) => normalize(r.foodName).includes(nq));
  }

  const bentoFoods = aggregateBentoFoods(rows);
  const foodCount = bentoFoods.length;
  const categoryCount = new Set(bentoFoods.map((f) => f.category)).size;

  const [bentoAllergens, weeklyEntries, texturesTried] = await Promise.all([
    loadAllergenStatus(childId),
    loadWeeklyEntries(childId),
    loadTexturesTried(childId)
  ]);

  return {
    entries: rows.slice(0, MAX_RENDERED_ENTRIES).map((r) => ({
      ...r,
      loggedByName: r.loggedByName ?? 'Compte supprimé',
      givenAt: toEpochMs(r.givenAt as Date | number | string)
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

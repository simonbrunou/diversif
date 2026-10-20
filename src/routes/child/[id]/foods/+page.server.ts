import { db } from '#lib/server/db/index.js';
import { foodEntries, foods, users } from '#lib/server/db/schema.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { requireChildContext } from '#lib/server/guards.js';
import { toEpochMs } from '#lib/utils/dates.js';
import { parisDayOf, thisWeek, utcMidnightOf } from '#lib/utils/civil-calendar.js';
import { REACTION_RANK } from '#lib/utils/reaction-values.js';
import {
  loadAllergenHistory,
  type AllergenHistory
} from '#lib/server/guidance/allergen-history.js';
import { loadChildHistory, type ChildHistory } from '#lib/server/guidance/child-history.js';
import * as m from '#lib/paraglide/messages.js';
import type { TextureKey } from '#lib/utils/textures.js';
import type { PageServerLoad } from './$types';

async function loadWeeklyEntries(
  childId: number,
  now: number
): Promise<{ counts: number[]; anchorUtc: number }> {
  // 7 daily buckets: oldest at index 0, today at index 6. Buckets are
  // Europe/Paris calendar days, so a food logged right after local midnight
  // lands in "today"'s bucket even though the server clock (and SQLite
  // storage) is UTC. anchorUtc names today's Paris date (utcMidnightOf) so
  // the client can label each bar against the same civil date without
  // SSR/CSR hydration drift.
  const week = thisWeek(now);
  const today = week[week.length - 1];
  // SQL pre-filter only needs to be a superset: real Paris-midnight instants
  // can be up to ~2h off from the UTC midnights utcMidnightOf returns, so
  // pad a full extra day on each side; exact bucketing below re-derives each
  // row's Paris civil day and is authoritative regardless of this margin.
  const start = new Date(utcMidnightOf(week[0] - 1));
  const end = new Date(utcMidnightOf(today + 2));

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

  const counts = week.map(() => 0);
  for (const r of rows) {
    const givenAtMs =
      r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt);
    const idx = week.indexOf(parisDayOf(givenAtMs));
    if (idx >= 0) counts[idx] += 1;
  }
  return { counts, anchorUtc: utcMidnightOf(today) };
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
  for (const r of rows) {
    const reaction = r.reaction;
    const existing = foodMap.get(r.foodId);
    if (existing) {
      existing.tried += 1;
      if (REACTION_RANK[reaction] > REACTION_RANK[existing.status]) existing.status = reaction;
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

async function loadTexturesTried(childId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(distinct ${foodEntries.texture})` })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`))
    .limit(1);
  // COUNT() always returns one row; the fallback only satisfies the types.
  return rows[0]?.n ?? 0;
}

// The tiles beside the list: the allergen pills, the 7-day bars and the
// textures count. The ?repeat=1 path passes the allergen history it already
// read with the child's history, instead of reading it a second time.
async function loadTiles(
  childId: number,
  now: number,
  allergens: AllergenHistory = loadAllergenHistory(db, childId, now)
) {
  const [weeklyEntries, texturesTried] = await Promise.all([
    loadWeeklyEntries(childId, now),
    loadTexturesTried(childId)
  ]);
  return { texturesTried, bentoAllergens: allergens.statuses, weeklyEntries };
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
  // One instant for the whole page: the weekly bars and the allergen pills.
  const now = Date.now();

  const conditions = buildFoodFilters(childId, category, reaction);

  let history: ChildHistory | undefined;
  if (repeat) {
    // Every food given <= 2 times, never with symptoms: the same candidates
    // the Aujourd'hui "Reproposez" cards narrow down (ruleRepeatExposure).
    history = loadChildHistory(db, childId, now);
    const ids = history.repeatCandidates.map((c) => c.foodId);
    if (ids.length === 0) {
      return {
        entries: [],
        filters: { q, category, reaction, repeat },
        bentoFoods: [],
        foodCount: 0,
        categoryCount: 0,
        ...(await loadTiles(childId, now, history.allergens))
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
    const { normalize } = await import('#lib/utils/search.js');
    const nq = normalize(q);
    rows = rows.filter((r) => normalize(r.foodName).includes(nq));
  }

  const bentoFoods = aggregateBentoFoods(rows);
  const foodCount = bentoFoods.length;
  const categoryCount = new Set(bentoFoods.map((f) => f.category)).size;

  return {
    entries: rows.slice(0, MAX_RENDERED_ENTRIES).map((r) => ({
      ...r,
      loggedByName: r.loggedByName ?? m.entryLoggedByDeletedAccount(),
      givenAt: toEpochMs(r.givenAt as Date | number | string)
    })),
    filters: { q, category, reaction, repeat },
    bentoFoods,
    foodCount,
    categoryCount,
    ...(await loadTiles(childId, now, history?.allergens))
  };
};

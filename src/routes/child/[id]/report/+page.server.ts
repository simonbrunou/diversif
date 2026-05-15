import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { ALLERGENS, PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
import { CATEGORY_IDS, type CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';
import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, type Stage } from '$lib/content/guidance';
import { TEXTURE_VALUES, type TextureKey, isTextureKey } from '$lib/utils/textures';
import type { PageServerLoad } from './$types';

export type ReportEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  allergenType: string | null;
  reaction: ReactionId;
  givenAt: number;
  notes: string | null;
  texture: TextureKey | null;
};

export type ReportFood = {
  foodId: number;
  foodName: string;
  category: CategoryId;
  firstGivenAt: number;
  lastGivenAt: number;
  exposures: number;
  worstReaction: ReactionId;
  allergenType: string | null;
};

export type AllergenReportRow = {
  id: string;
  label: string;
  isPriority: boolean;
  status: 'introduced' | 'untested';
  worst: ReactionId | null;
  exposures: number;
  firstGivenAt: number | null;
  lastGivenAt: number | null;
};

export const load: PageServerLoad = async ({ parent }) => {
  const { child } = await parent();
  const childId = child.id;

  // Pull all entries with their food join, ordered chronologically.
  const rows = await db
    .select({
      id: foodEntries.id,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt,
      notes: foodEntries.notes,
      texture: foodEntries.texture
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId))
    .orderBy(asc(foodEntries.givenAt));

  const entries: ReportEntry[] = rows.map((r) => ({
    id: r.id,
    foodId: r.foodId,
    foodName: r.foodName,
    category: r.category as CategoryId,
    allergenType: r.allergenType,
    reaction: r.reaction as ReactionId,
    givenAt:
      r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt),
    notes: r.notes,
    texture: isTextureKey(r.texture) ? r.texture : null
  }));

  const reactionRank: Record<ReactionId, number> = { ras: 0, inconfort: 1, reaction: 2 };

  // Aggregate per food: first/last/count/worst.
  const byFood = new Map<number, ReportFood>();
  for (const e of entries) {
    const cur = byFood.get(e.foodId);
    if (!cur) {
      byFood.set(e.foodId, {
        foodId: e.foodId,
        foodName: e.foodName,
        category: e.category,
        firstGivenAt: e.givenAt,
        lastGivenAt: e.givenAt,
        exposures: 1,
        worstReaction: e.reaction,
        allergenType: e.allergenType
      });
    } else {
      cur.lastGivenAt = e.givenAt;
      cur.exposures += 1;
      if (reactionRank[e.reaction] > reactionRank[cur.worstReaction]) {
        cur.worstReaction = e.reaction;
      }
    }
  }
  const foodsByCategory = new Map<CategoryId, ReportFood[]>();
  for (const id of CATEGORY_IDS) foodsByCategory.set(id as CategoryId, []);
  for (const f of byFood.values()) {
    foodsByCategory.get(f.category)?.push(f);
  }
  for (const list of foodsByCategory.values()) {
    list.sort((a, b) => a.firstGivenAt - b.firstGivenAt);
  }
  const categoryGroups = Array.from(foodsByCategory.entries())
    .filter(([, list]) => list.length > 0)
    .map(([id, list]) => ({ id, foods: list }));

  // Per-allergen summary: introduced / worst / counts. Derived from `entries`
  // in memory rather than a second SQL scan : `entries` already contains
  // exactly the columns we need (allergenType, reaction, givenAt) because the
  // primary query above joins on the food catalog.
  const allergenAggMap = new Map<
    string,
    { worst: ReactionId; exposures: number; first: number; last: number }
  >();
  for (const e of entries) {
    if (e.allergenType == null) continue;
    const cur = allergenAggMap.get(e.allergenType);
    if (!cur) {
      allergenAggMap.set(e.allergenType, {
        worst: e.reaction,
        exposures: 1,
        first: e.givenAt,
        last: e.givenAt
      });
    } else {
      cur.exposures += 1;
      cur.first = Math.min(cur.first, e.givenAt);
      cur.last = Math.max(cur.last, e.givenAt);
      if (reactionRank[e.reaction] > reactionRank[cur.worst]) cur.worst = e.reaction;
    }
  }

  const allergens: AllergenReportRow[] = ALLERGENS.map((a) => {
    const agg = allergenAggMap.get(a.id);
    const isPriority = (PRIORITY_INTRODUCTION_ALLERGENS as readonly string[]).includes(a.id);
    if (!agg) {
      return {
        id: a.id,
        label: a.label,
        isPriority,
        status: 'untested' as const,
        worst: null,
        exposures: 0,
        firstGivenAt: null,
        lastGivenAt: null
      };
    }
    return {
      id: a.id,
      label: a.label,
      isPriority,
      status: 'introduced' as const,
      worst: agg.worst,
      exposures: agg.exposures,
      firstGivenAt: agg.first,
      lastGivenAt: agg.last
    };
  }).sort((x, y) => {
    // Priority allergens first; within each group sort alphabetically (FR).
    const p = Number(!x.isPriority) - Number(!y.isPriority);
    if (p !== 0) return p;
    return x.label.localeCompare(y.label, 'fr');
  });

  // Notable reactions for the timeline section: every inconfort/réaction
  // entry, oldest first. We deliberately don't cap : this section exists so
  // the pediatrician sees the full reaction history, and silently dropping
  // older entries would defeat the report's purpose.
  const notable = entries.filter((e) => e.reaction !== 'ras');

  // Most advanced texture in the progression (finger excluded: parallel/opt-in).
  let mostAdvancedIdx = -1;
  for (const e of entries) {
    if (!isTextureKey(e.texture)) continue;
    if (e.texture === 'finger') continue;
    const idx = TEXTURE_VALUES.indexOf(e.texture);
    if (idx > mostAdvancedIdx) mostAdvancedIdx = idx;
  }
  const mostAdvancedTexture: TextureKey | null =
    mostAdvancedIdx >= 0 ? TEXTURE_VALUES[mostAdvancedIdx] : null;

  // 30-day texture distribution: count each texture key logged in the window.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - THIRTY_DAYS_MS;

  const counts: Record<TextureKey, number> = {
    lisse: 0,
    moulinee: 0,
    ecrasee: 0,
    'petits-morceaux': 0,
    morceaux: 0,
    finger: 0
  };
  let totalWithTexture = 0;
  for (const e of entries) {
    if (e.givenAt < cutoff) continue;
    if (!isTextureKey(e.texture)) continue;
    counts[e.texture] += 1;
    totalWithTexture += 1;
  }

  const textureDistribution = { counts, totalWithTexture };

  // Current diversification stage derived from child age at report time.
  const stage: Stage = getStageForAgeMonths(ageInMonths(child.birthDate));

  return {
    generatedAt: Date.now(),
    stage,
    mostAdvancedTexture,
    textureDistribution,
    totals: {
      foods: byFood.size,
      entries: entries.length,
      categoriesCovered: categoryGroups.filter((g) => g.id !== 'autre').length,
      categoriesTotal: CATEGORY_IDS.length - 1,
      allergensIntroduced: allergens.filter((a) => a.status === 'introduced').length,
      allergensTotal: ALLERGENS.length
    },
    categoryGroups,
    allergens,
    notable
  };
};

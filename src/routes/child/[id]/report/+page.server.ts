import { db } from '#lib/server/db/index.js';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { asc, eq } from 'drizzle-orm';
import { ALLERGENS } from '#lib/utils/allergens.js';
import { allergenHistoryFrom } from '#lib/server/guidance/allergen-history.js';
import { CATEGORY_IDS, type CategoryId } from '#lib/utils/categories.js';
import type { ReactionId } from '#lib/utils/reactions.js';
import { REACTION_RANK } from '#lib/utils/reaction-values.js';
import { ageInMonths } from '#lib/utils/age.js';
import { DAY_MS } from '#lib/utils/civil-calendar.js';
import { toEpochMs } from '#lib/utils/dates.js';
import { getStageForAgeMonths, type Stage } from '#lib/content/guidance.js';
import { TEXTURE_VALUES, type TextureKey, isTextureKey } from '#lib/utils/textures.js';
import { requireChildContext } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

type ReportEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  allergenType: string | null;
  reaction: ReactionId;
  givenAt: number;
  notes: string | null;
  texture: TextureKey | null;
  mealId: string | null;
};

type ReportFood = {
  foodId: number;
  foodName: string;
  category: CategoryId;
  firstGivenAt: number;
  lastGivenAt: number;
  exposures: number;
  worstReaction: ReactionId;
  allergenType: string | null;
};

// Aggregate per food (first/last/count/worst), bucket by category, drop empty
// categories. `byFood` is returned too so callers can read its size for totals.
function aggregateFoods(entries: ReportEntry[]): {
  byFood: Map<number, ReportFood>;
  categoryGroups: { id: CategoryId; foods: ReportFood[] }[];
} {
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
      if (REACTION_RANK[e.reaction] > REACTION_RANK[cur.worstReaction]) {
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
  return { byFood, categoryGroups };
}

// Most advanced texture in the progression (finger excluded: parallel/opt-in).
function computeMostAdvancedTexture(entries: ReportEntry[]): TextureKey | null {
  let mostAdvancedIdx = -1;
  for (const e of entries) {
    if (!isTextureKey(e.texture)) continue;
    if (e.texture === 'finger') continue;
    const idx = TEXTURE_VALUES.indexOf(e.texture);
    if (idx > mostAdvancedIdx) mostAdvancedIdx = idx;
  }
  return mostAdvancedIdx >= 0 ? TEXTURE_VALUES[mostAdvancedIdx] : null;
}

// 30-day texture distribution: count each texture key logged in the 30 × 24
// hours before `now`.
function computeTextureDistribution(
  entries: ReportEntry[],
  now: number
): {
  counts: Record<TextureKey, number>;
  totalWithTexture: number;
} {
  const cutoff = now - 30 * DAY_MS;

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
    if (e.givenAt < cutoff || e.givenAt > now) continue;
    if (!isTextureKey(e.texture)) continue;
    counts[e.texture] += 1;
    totalWithTexture += 1;
  }
  return { counts, totalWithTexture };
}

export const load: PageServerLoad = async ({ parent, locals, params }) => {
  // In-file membership guard, consistent with the sibling child routes
  // (foods/log/suggestions/settings all guard in their own load). childId comes
  // straight from the guard so this call is load-bearing — not removable
  // duplication of the layout guard — and the tenant check stays resilient to
  // any future refactor that decouples the load chain. `child` (name/birthDate)
  // still comes from the layout via parent().
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  // One instant for the whole report: the age, the texture window, the
  // allergen day counts and the printed generation time.
  const now = Date.now();

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
      texture: foodEntries.texture,
      mealId: foodEntries.mealId
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
    givenAt: toEpochMs(r.givenAt as Date | number | string),
    notes: r.notes,
    texture: isTextureKey(r.texture) ? r.texture : null,
    mealId: r.mealId
  }));

  const { byFood, categoryGroups } = aggregateFoods(entries);

  // Built from `entries` in memory rather than a second SQL scan: the primary
  // query already carries every column the allergen history reads.
  const allergens = allergenHistoryFrom(entries, now).bilanRows;

  // Notable reactions for the timeline section: every inconfort/réaction
  // entry, oldest first. We deliberately don't cap : this section exists so
  // the pediatrician sees the full reaction history, and silently dropping
  // older entries would defeat the report's purpose.
  const notable = entries.filter((e) => e.reaction !== 'ras');

  const mostAdvancedTexture = computeMostAdvancedTexture(entries);

  const textureDistribution = computeTextureDistribution(entries, now);

  // Current diversification stage derived from child age at report time.
  const ageMonths = ageInMonths(child.birthDate, new Date(now));
  const stage: Stage = getStageForAgeMonths(ageMonths);

  return {
    generatedAt: now,
    ageMonths,
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

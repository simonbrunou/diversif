import type { Food } from '$lib/server/db/schema';
import type { CategoryId } from '$lib/utils/categories';
import { getStageForAgeMonths, type StageId } from '$lib/content/guidance';
import { getQuantitiesForStage, type StageQuantities } from '$lib/content/quantities';
import { FORBIDDEN_FOODS } from '$lib/content/guidance';
import {
  ROLE_POOLS,
  FAT_EXCLUDE,
  CHARCUTERIE_MATCHERS,
  PORC_MATCHERS,
  SOFT_CHEESE,
  CHOKING_BY_FOOD,
  type RoleId,
  type MealId
} from './tables';

export type MenuInput = {
  childId: number;
  ageMonths: number;
  dayIndex: number;
  weekday: number;
  catalog: Food[];
  introducedFoodIds: Set<number>;
  avoidFoodIds: Set<number>;
  reactionTierFoodIds: Set<number>;
  introducedAllergens: Set<string>;
  reactedAllergens: Set<string>;
  dietaryExclusions: string[]; // DietExclusion[] once Phase 3 lands
};

export type MenuItem = {
  role: RoleId;
  food: Food;
  amountHint: string | null;
  texture: string;
  caution: string | null;
  isNew: boolean;
  allergenType: string | null;
};
export type Meal = { id: MealId; label: string; items: MenuItem[] };
export type Menu = {
  stageId: StageId;
  quantities: StageQuantities;
  textures: string;
  redFlags: string[];
  meals: Meal[];
  allergenFocus: { food: Food; mode: 'introduce' | 'maintain' } | null;
  noveltyFoodId: number | null;
};

const CHARCUTERIE = (f: Food) => CHARCUTERIE_MATCHERS.some((m) => f.name.includes(m));

function forbiddenAtAge(f: Food, ageMonths: number): boolean {
  for (const ff of FORBIDDEN_FOODS) {
    if (ff.untilMonths == null || !ff.nameMatchers) continue;
    if (ageMonths < ff.untilMonths && ff.nameMatchers.some((s) => f.name.toLowerCase().includes(s)))
      return true;
  }
  return false;
}

function excludedByDiet(f: Food, exclusions: string[]): boolean {
  if (exclusions.includes('porc') && PORC_MATCHERS.some((m) => f.name.includes(m))) return true;
  if (exclusions.includes('vegetarien') && (f.category === 'viandes' || f.category === 'poissons'))
    return true;
  if (exclusions.includes('sans_poisson') && f.category === 'poissons') return true;
  return false;
}

/** Age-eligible ∩ ¬forbidden ∩ ¬diet ∩ ¬reaction-blocked, for a role, sorted by id. */
function safeForRole(role: RoleId, input: MenuInput): Food[] {
  const cats = new Set<CategoryId>(ROLE_POOLS[role]);
  const ageMax = Math.max(input.ageMonths, 4);
  return input.catalog
    .filter((f) => !f.isCustom)
    .filter((f) => cats.has(f.category as CategoryId))
    .filter((f) => f.suggestedAgeMonths <= ageMax)
    .filter((f) => !forbiddenAtAge(f, input.ageMonths))
    .filter((f) => !excludedByDiet(f, input.dietaryExclusions))
    .filter((f) => (role === 'matiereGrasse' ? !FAT_EXCLUDE.includes(f.name) : true))
    .filter((f) => (role === 'proteine' ? !CHARCUTERIE(f) : true))
    .filter((f) => {
      // reaction avoidance: per-food for inconfort, per-allergen for reaction tier
      if (input.avoidFoodIds.has(f.id) && !input.reactionTierFoodIds.has(f.id)) return false;
      if (f.allergenType && input.reactedAllergens.has(f.allergenType)) return false;
      if (input.reactionTierFoodIds.has(f.id)) return false;
      return true;
    })
    .sort((a, b) => a.id - b.id);
}

const textureFor = (f: Food): string | null => CHOKING_BY_FOOD[f.name] ?? null;

function cautionFor(f: Food): string | null {
  const choke = textureFor(f);
  if (choke) return choke;
  if (f.category === 'poissons') return 'Bien cuit, sans arêtes.';
  if (f.category === 'viandes') return 'Haché ou petits morceaux fondants.';
  if (SOFT_CHEESE.includes(f.name)) return 'Au lait pasteurisé uniquement.';
  return null;
}

export function buildMenu(input: MenuInput): Menu {
  const stage = getStageForAgeMonths(input.ageMonths);
  const quantities = getQuantitiesForStage(stage.id);
  const base: Menu = {
    stageId: stage.id,
    quantities,
    textures: stage.textures,
    redFlags: [...stage.redFlags],
    meals: [],
    allergenFocus: null,
    noveltyFoodId: null
  };

  // Age branch FIRST (getStageForAgeMonths clamps <4 to '4-6').
  if (input.ageMonths < 4) return base; // zero solids, milk message only
  // 4-6: single food (filled by rotation in Task 8); return base here until Task 8.
  return base; // completed in Task 8/9
}

const mkItem = (
  role: RoleId,
  food: Food,
  stageTexture: string,
  amountHint: string | null,
  isNew: boolean
): MenuItem => ({
  role,
  food,
  amountHint,
  texture: stageTexture,
  caution: cautionFor(food),
  isNew,
  allergenType: food.allergenType
});

export { safeForRole, mkItem, cautionFor }; // internal, exported for unit tests

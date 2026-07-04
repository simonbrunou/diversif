import type { Food } from '$lib/server/db/schema';
import type { CategoryId } from '$lib/utils/categories';
import { getStageForAgeMonths, type Stage, type StageId } from '$lib/content/guidance';
import { getQuantitiesForStage, type StageQuantities } from '$lib/content/quantities';
import { FORBIDDEN_FOODS } from '$lib/content/guidance';
import {
  ROLE_POOLS,
  FAT_EXCLUDE,
  CHARCUTERIE_MATCHERS,
  PORC_MATCHERS,
  SOFT_CHEESE,
  CHOKING_BY_FOOD,
  MEAL_TEMPLATES,
  PROTEIN_WEEK,
  OILY_FISH,
  type RoleId,
  type MealId
} from './tables';
import { rotatePick } from './rotation';

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

function proteinOccurrence(cat: CategoryId, dayIndex: number, weekday: number): number {
  // Count same-category protein-weekdays in [0, dayIndex] in the single Monday frame, so a
  // category's successive appearances stride by exactly 1 (even for a hypothetical k=3 pool).
  const startMonday = dayIndex - weekday; // dayIndex of this week's Monday
  const fullWeeks = Math.max(0, Math.floor(startMonday / 7)); // dayIndex >= 0 in prod
  const perWeek = PROTEIN_WEEK.filter((c) => c === cat).length;
  let occ = fullWeeks * perWeek;
  for (let d = 0; d <= weekday; d++) if (PROTEIN_WEEK[d] === cat) occ++;
  return occ;
}

// INTRODUCED-ONLY. Empty weekday-category (or vegetarien/sans_poisson) → the whole
// introduced-safe protein pool. NEVER an un-introduced food — that would be a covert second
// novelty (the one-novelty hazard). null → "à découvrir" when no protein is introduced yet.
function pickProtein(input: MenuInput): Food | null {
  const cat = PROTEIN_WEEK[input.weekday];
  const introducedSafe = safeForRole('proteine', input).filter((f) =>
    input.introducedFoodIds.has(f.id)
  );
  const inCat = introducedSafe.filter((f) => f.category === cat);
  const pool = inCat.length ? inCat : introducedSafe;
  if (pool.length === 0) return null;
  const oily = input.weekday === 1 ? pool.filter((f) => OILY_FISH.includes(f.name)) : [];
  const list = oily.length ? oily : pool;
  const occ = proteinOccurrence(cat, input.dayIndex, input.weekday);
  return list[((occ % list.length) + list.length) % list.length];
}

// Per-role amount hint, sourced from the stage's quantities. A plain lookup (not a branching
// chain) — every RoleId is an explicit key, so TS itself enforces exhaustiveness.
function amountFor(role: RoleId, quantities: StageQuantities): string | null {
  const q = quantities.portions;
  const byRole: Record<RoleId, string | null> = {
    proteine: quantities.proteinPerDay,
    legume: q.legume,
    fruit: q.fruit,
    feculent: q.feculent,
    laitier: q.laitier,
    dessert: q.laitier,
    matiereGrasse: q.matiereGrasse
  };
  return byRole[role];
}

// 4-6: exactly one first food (introduced-preferred; a genuine first food may be new and is
// then badged as the day's novelty).
function buildStarterMeal(
  input: MenuInput,
  stage: Stage,
  quantities: StageQuantities
): { meals: Meal[]; noveltyFoodId: number | null } {
  const pool = [...safeForRole('legume', input), ...safeForRole('fruit', input)].sort(
    (a, b) => a.id - b.id
  );
  const intro = pool.filter((f) => input.introducedFoodIds.has(f.id));
  const food = rotatePick(intro.length ? intro : pool, `${input.childId}:starter`, input.dayIndex);
  if (!food) return { meals: [], noveltyFoodId: null };
  const role: RoleId = food.category === 'fruits' ? 'fruit' : 'legume';
  const isNew = !input.introducedFoodIds.has(food.id);
  return {
    meals: [
      {
        id: 'midi',
        label: food.name,
        items: [mkItem(role, food, stage.textures, amountFor(role, quantities), isNew)]
      }
    ],
    noveltyFoodId: isNew ? food.id : null
  };
}

// 6-9 / 9-12 / 12-36: each slot picks from its INTRODUCED-safe foods only.
function assembleFullDayMeals(input: MenuInput, stage: Stage, quantities: StageQuantities): Meal[] {
  const meals: Meal[] = [];
  for (const t of MEAL_TEMPLATES[stage.id]) {
    const items: MenuItem[] = [];
    for (const role of t.roles) {
      const food =
        role === 'proteine'
          ? pickProtein(input)
          : rotatePick(
              safeForRole(role, input).filter((f) => input.introducedFoodIds.has(f.id)),
              `${input.childId}:${t.id}:${role}`,
              input.dayIndex
            );
      if (food) items.push(mkItem(role, food, stage.textures, amountFor(role, quantities), false));
      // null → empty slot; MenuDay renders an "à découvrir" prompt for the missing role.
    }
    meals.push({ id: t.id, label: '', items });
  }
  return meals;
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

  // Returns BEFORE the full-day assembly + novelty pass.
  if (stage.id === '4-6') {
    const starter = buildStarterMeal(input, stage, quantities);
    base.meals = starter.meals;
    base.noveltyFoodId = starter.noveltyFoodId;
    return base;
  }

  base.meals = assembleFullDayMeals(input, stage, quantities);
  return base; // Task 9 inserts the novelty/dedup pass just before this return.
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

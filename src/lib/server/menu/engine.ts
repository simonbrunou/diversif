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
  NOVELTY_CATEGORIES,
  type RoleId,
  type MealId
} from './tables';
import { rotatePick } from './rotation';
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

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
export type Meal = { id: MealId; label: string; items: MenuItem[]; discoverRoles: RoleId[] };
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
        items: [mkItem(role, food, stage.textures, amountFor(role, quantities), isNew)],
        discoverRoles: []
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
    meals.push({ id: t.id, label: '', items, discoverRoles: [] });
  }
  return meals;
}

// ---- allergen focus + ONE proactive novelty (meals are already introduced-only) ----

function allowedAllergen(input: MenuInput, a: string): boolean {
  return (
    !input.reactedAllergens.has(a) &&
    !(input.dietaryExclusions.includes('sans_poisson') && a === 'poisson') &&
    !(input.dietaryExclusions.includes('vegetarien') && a === 'poisson')
  );
}

// The novelty path uses THIS predicate, not safeForRole — so it must repeat every
// role-independent safety gate safeForRole applies, or an un-safe food slips in as a badged
// "Nouveauté". Charcuterie (Jambon) is never a protéine AND never a novelty. FAT_EXCLUDE is
// defence-in-depth: matieres_grasses isn't in NOVELTY_CATEGORIES today, so it's currently
// unreachable — but adding it there must never turn butter into a novelty.
function catalogSafe(f: Food, input: MenuInput): boolean {
  return (
    f.suggestedAgeMonths <= Math.max(input.ageMonths, 4) &&
    !f.isCustom &&
    !forbiddenAtAge(f, input.ageMonths) &&
    !excludedByDiet(f, input.dietaryExclusions) &&
    !CHARCUTERIE(f) &&
    !FAT_EXCLUDE.includes(f.name) &&
    !input.avoidFoodIds.has(f.id) &&
    !input.reactionTierFoodIds.has(f.id) &&
    !(f.allergenType && input.reactedAllergens.has(f.allergenType))
  );
}

// A priority allergen due? Rotate the "allergène du jour" by dayIndex. It IS the day's one
// novelty and is surfaced ONLY in the allergenFocus card (allergenes has no meal role;
// role-bearing allergens stay card-only too, so no meal slot ever shows a new food).
function pickDueAllergenFood(input: MenuInput): Food | null {
  const dueList = PRIORITY_INTRODUCTION_ALLERGENS.filter(
    (a) => !input.introducedAllergens.has(a) && allowedAllergen(input, a)
  ).sort();
  const dueAllergen = rotatePick(dueList, `${input.childId}:allergenFocus`, input.dayIndex);
  if (!dueAllergen) return null;
  return (
    input.catalog
      .filter((f) => f.allergenType === dueAllergen && catalogSafe(f, input))
      .sort((a, b) => a.id - b.id)[0] ?? null
  );
}

// No allergen to introduce → maintain focus on an INTRODUCED allergen food.
function pickMaintainAllergenFood(input: MenuInput): Food | null {
  const maintainList = PRIORITY_INTRODUCTION_ALLERGENS.filter(
    (a) => input.introducedAllergens.has(a) && allowedAllergen(input, a)
  ).sort();
  const maintainA = rotatePick(maintainList, `${input.childId}:maintain`, input.dayIndex);
  if (!maintainA) return null;
  return (
    input.catalog
      .filter(
        (f) =>
          f.allergenType === maintainA && input.introducedFoodIds.has(f.id) && catalogSafe(f, input)
      )
      .sort((a, b) => a.id - b.id)[0] ?? null
  );
}

// Feature ONE not-yet-tried role-bearing food in a meal slot (never an allergen-card food —
// those are handled, and stay card-only, above).
function pickNoveltyCandidate(input: MenuInput): Food | null {
  const candidates = input.catalog
    .filter((f) => NOVELTY_CATEGORIES.includes(f.category as CategoryId))
    .filter((f) => !input.introducedFoodIds.has(f.id))
    .filter((f) => catalogSafe(f, input))
    .sort((a, b) => a.id - b.id);
  return rotatePick(candidates, `${input.childId}:novelty`, input.dayIndex);
}

function roleForCategory(cat: CategoryId): RoleId | null {
  const map: Partial<Record<CategoryId, RoleId>> = {
    legumes: 'legume',
    fruits: 'fruit',
    feculents: 'feculent',
    legumineuses: 'proteine',
    viandes: 'proteine',
    poissons: 'proteine',
    oeufs: 'proteine',
    produits_laitiers: 'laitier',
    matieres_grasses: 'matiereGrasse'
  };
  return map[cat] ?? null;
}

// Feature the novelty in the EARLIEST meal whose TEMPLATE lists its role. Replace that role's
// introduced base pick if present; otherwise INSERT a new item (the slot was empty because no
// food of that role is introduced yet), so the one proactive novelty is never silently dropped.
function placeNovelty(menu: Menu, role: RoleId, food: Food, stageTexture: string): void {
  for (const t of MEAL_TEMPLATES[menu.stageId]) {
    if (!t.roles.includes(role)) continue;
    const meal = menu.meals.find((mo) => mo.id === t.id);
    if (!meal) continue;
    const item = mkItem(role, food, stageTexture, null, true);
    const existing = meal.items.find((i) => i.role === role);
    if (existing) Object.assign(existing, item);
    else meal.items.push(item);
    return;
  }
}

// Resolve the day's allergen-focus card + the one proactive novelty, and place the novelty in
// its meal slot. An allergen due for introduction always wins and is card-only (never placed);
// otherwise an introduced allergen is maintained on the card AND a non-allergen novelty is
// placed in a meal slot.
function applyAllergenFocusAndNovelty(base: Menu, input: MenuInput, stage: Stage): void {
  const dueFood = pickDueAllergenFood(input);
  if (dueFood) {
    base.allergenFocus = { food: dueFood, mode: 'introduce' };
    base.noveltyFoodId = dueFood.id; // card-only; never inserted into a meal slot
    return;
  }
  const maintainFood = pickMaintainAllergenFood(input);
  if (maintainFood) base.allergenFocus = { food: maintainFood, mode: 'maintain' };
  const novelty = pickNoveltyCandidate(input);
  base.noveltyFoodId = novelty?.id ?? null;
  if (!novelty) return;
  const role = roleForCategory(novelty.category as CategoryId);
  if (role) placeNovelty(base, role, novelty, stage.textures);
}

// Intra-day dedup, over the introduced base picks only (never the novelty): when a later slot
// would repeat an earlier slot's food, swap it for an alternate from its introduced pool.
function dedupSlot(slot: MenuItem, meal: Meal, input: MenuInput, seen: Set<number>): void {
  if (slot.isNew) {
    seen.add(slot.food.id);
    return;
  }
  if (seen.has(slot.food.id)) {
    const alt = rotatePick(
      safeForRole(slot.role, input).filter(
        (f) => input.introducedFoodIds.has(f.id) && !seen.has(f.id)
      ),
      `${input.childId}:${meal.id}:${slot.role}:dedup`,
      input.dayIndex
    );
    if (alt) {
      slot.food = alt;
      slot.caution = cautionFor(alt);
      slot.allergenType = alt.allergenType;
    }
  }
  seen.add(slot.food.id);
}

function dedupMealItems(base: Menu, input: MenuInput): void {
  const seen = new Set<number>();
  for (const meal of base.meals) {
    for (const slot of meal.items) dedupSlot(slot, meal, input, seen);
    meal.label = meal.items.map((i) => i.food.name).join(' · ');
  }
}

// Entry point for Task 9's post-assembly pass: allergen focus, the one proactive novelty, and
// the intra-day dedup + middot labels. Split into small helpers (rather than inlined here) to
// stay under fallow's per-function complexity gate.
function applyDayNovelty(base: Menu, input: MenuInput, stage: Stage): void {
  applyAllergenFocusAndNovelty(base, input, stage);
  dedupMealItems(base, input);
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
  applyDayNovelty(base, input, stage);

  for (const meal of base.meals) {
    const wanted = MEAL_TEMPLATES[stage.id].find((t) => t.id === meal.id)?.roles ?? [];
    const have = new Set(meal.items.map((i) => i.role));
    meal.discoverRoles = wanted.filter((r) => !have.has(r));
  }

  return base;
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

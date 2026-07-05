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
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
import type { DietExclusion } from '$lib/utils/diet';

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
  // Typed against $lib/utils/diet's enum (not a bare string[]) so a DIET_EXCLUSIONS
  // rename/removal is a compile error at every literal match site below.
  dietaryExclusions: DietExclusion[];
};

type MenuItem = {
  role: RoleId;
  food: Food;
  amountHint: string | null;
  texture: string;
  caution: string | null;
  isNew: boolean;
  allergenType: string | null;
};
type Meal = { id: MealId; label: string; items: MenuItem[]; discoverRoles: RoleId[] };
export type Menu = {
  stageId: StageId;
  quantities: StageQuantities;
  textures: string;
  redFlags: string[];
  meals: Meal[];
  allergenFocus: { food: Food; mode: 'introduce' | 'maintain'; caution: string | null } | null;
};

const CHARCUTERIE = (f: Food) => CHARCUTERIE_MATCHERS.some((m) => f.name.includes(m));

// Matches the Set-based lookup pattern in allergen-status.ts / AujourdhuiBento.svelte.
const PRIORITY_ALLERGEN_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

function forbiddenAtAge(f: Food, ageMonths: number): boolean {
  for (const ff of FORBIDDEN_FOODS) {
    if (ff.untilMonths == null || !ff.nameMatchers) continue;
    if (ageMonths < ff.untilMonths && ff.nameMatchers.some((s) => f.name.toLowerCase().includes(s)))
      return true;
  }
  return false;
}

function excludedByDiet(f: Food, exclusions: DietExclusion[]): boolean {
  if (exclusions.includes('porc') && PORC_MATCHERS.some((m) => f.name.includes(m))) return true;
  if (exclusions.includes('vegetarien') && (f.category === 'viandes' || f.category === 'poissons'))
    return true;
  if (exclusions.includes('sans_poisson') && f.category === 'poissons') return true;
  return false;
}

// Role-independent safety gates shared by EVERY food-surfacing path (role pools
// via safeForRole, AND the allergen-focus catalog scan via catalogSafe): age
// window, ¬custom, ¬forbidden-at-age, ¬diet-excluded, ¬avoid/reaction-blocked.
// Charcuterie and FAT_EXCLUDE are deliberately NOT here — they're role-scoped
// (safeForRole only applies them for proteine/matiereGrasse) or defense-in-depth
// (catalogSafe applies them unconditionally) — each caller layers them on itself.
function safeFood(f: Food, input: MenuInput): boolean {
  return (
    !f.isCustom &&
    f.suggestedAgeMonths <= Math.max(input.ageMonths, 4) &&
    !forbiddenAtAge(f, input.ageMonths) &&
    !excludedByDiet(f, input.dietaryExclusions) &&
    // reaction avoidance: per-food for inconfort, per-allergen for reaction tier
    !input.avoidFoodIds.has(f.id) &&
    !input.reactionTierFoodIds.has(f.id) &&
    !(f.allergenType && input.reactedAllergens.has(f.allergenType))
  );
}

/** Age-eligible ∩ ¬forbidden ∩ ¬diet ∩ ¬reaction-blocked, for a role, sorted by id. */
function safeForRole(role: RoleId, input: MenuInput): Food[] {
  const cats = new Set<CategoryId>(ROLE_POOLS[role]);
  return input.catalog
    .filter((f) => cats.has(f.category as CategoryId))
    .filter((f) => safeFood(f, input))
    .filter((f) => (role === 'matiereGrasse' ? !FAT_EXCLUDE.includes(f.name) : true))
    .filter((f) => (role === 'proteine' ? !CHARCUTERIE(f) : true))
    .sort((a, b) => a.id - b.id);
}

// Un-introduced priority-allergen foods stay gated to the one-a-day allergène card
// (several new allergens in one day breaks the one-at-a-time safety line). Introduced
// foods (allergen or not) and un-introduced NON-priority-allergen foods fill slots freely.
function slotEligible(f: Food, input: MenuInput): boolean {
  if (input.introducedFoodIds.has(f.id)) return true;
  return !(
    f.allergenType &&
    PRIORITY_ALLERGEN_SET.has(f.allergenType) &&
    !input.introducedAllergens.has(f.allergenType)
  );
}

/** safeForRole, further gated so an un-introduced priority allergen never fills a meal slot. */
function slotPool(role: RoleId, input: MenuInput): Food[] {
  return safeForRole(role, input).filter((f) => slotEligible(f, input));
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

// Full-variety pool (slotPool), not introduced-only: an un-introduced protein CAN win here,
// badged as the day's novelty by the caller — EXCEPT an un-introduced priority allergen, which
// slotPool already excludes. Empty weekday-category (or vegetarien/sans_poisson) → the whole
// slot-eligible protein pool. null → "à découvrir" when no protein is eligible at all yet.
function pickProtein(input: MenuInput): Food | null {
  const cat = PROTEIN_WEEK[input.weekday];
  const pickable = slotPool('proteine', input);
  const inCat = pickable.filter((f) => f.category === cat);
  const pool = inCat.length ? inCat : pickable;
  if (pool.length === 0) return null;
  const oily = input.weekday === 1 ? pool.filter((f) => OILY_FISH.includes(f.name)) : [];
  const list = oily.length ? oily : pool;
  // rotatePick (not an occurrence counter): on a FIXED weekday, dayIndex strides
  // by 7 across weeks, so this index strides by 7 mod n — a full cycle of the
  // whole pool for any n coprime with 7 (every realistic pool size), unlike an
  // occurrence counter whose fixed parity on a fixed weekday only ever reaches
  // half an even-sized pool.
  return rotatePick(list, `${input.childId}:proteine`, input.dayIndex);
}

// Per-role amount hint, sourced from the stage's quantities. A plain lookup (not a branching
// chain) — every RoleId is an explicit key, so TS itself enforces exhaustiveness. `dessert`
// draws from TWO categories (ROLE_POOLS.dessert = fruits ∪ produits_laitiers), so its hint
// follows the resolved food's actual category rather than a single role-wide default —
// otherwise a fruit dessert would render the laitier hint (e.g. "Pomme · 1 laitage").
function amountFor(role: RoleId, quantities: StageQuantities, food: Food): string | null {
  const q = quantities.portions;
  const byRole: Record<RoleId, string | null> = {
    proteine: quantities.proteinPerDay,
    legume: q.legume,
    fruit: q.fruit,
    feculent: q.feculent,
    laitier: q.laitier,
    dessert: food.category === 'fruits' ? q.fruit : q.laitier,
    matiereGrasse: q.matiereGrasse
  };
  return byRole[role];
}

// 4-6: exactly one first food, drawn from the full slot-eligible legume+fruit pool (a
// genuine first food may be new and is then badged as a novelty).
function buildStarterMeal(input: MenuInput, stage: Stage, quantities: StageQuantities): Meal[] {
  const pool = [...slotPool('legume', input), ...slotPool('fruit', input)].sort(
    (a, b) => a.id - b.id
  );
  const food = rotatePick(pool, `${input.childId}:starter`, input.dayIndex);
  if (!food) return [];
  const role: RoleId = food.category === 'fruits' ? 'fruit' : 'legume';
  const isNew = !input.introducedFoodIds.has(food.id);
  return [
    {
      id: 'midi',
      label: food.name,
      items: [mkItem(role, food, stage.textures, amountFor(role, quantities, food), isNew)],
      discoverRoles: []
    }
  ];
}

// 6-9 / 9-12 / 12-36: each slot picks from its full slot-eligible pool (slotPool) — the whole
// age-appropriate safe catalog, not just introduced foods — badging an un-introduced pick as
// the day's "Nouveauté". slotPool already keeps an un-introduced priority allergen out of every
// slot (gated to the allergène-du-jour card instead).
function assembleFullDayMeals(input: MenuInput, stage: Stage, quantities: StageQuantities): Meal[] {
  const meals: Meal[] = [];
  for (const t of MEAL_TEMPLATES[stage.id]) {
    const items: MenuItem[] = [];
    for (const role of t.roles) {
      const food =
        role === 'proteine'
          ? pickProtein(input)
          : rotatePick(slotPool(role, input), `${input.childId}:${t.id}:${role}`, input.dayIndex);
      if (food) {
        const isNew = !input.introducedFoodIds.has(food.id);
        items.push(mkItem(role, food, stage.textures, amountFor(role, quantities, food), isNew));
      }
      // null → empty slot; MenuDay renders an "à découvrir" prompt for the missing role.
    }
    meals.push({ id: t.id, label: '', items, discoverRoles: [] });
  }
  return meals;
}

// ---- allergen-du-jour focus card (meal slots carry their own novelties directly) ----

function allowedAllergen(input: MenuInput, a: string): boolean {
  return (
    !input.reactedAllergens.has(a) &&
    !(input.dietaryExclusions.includes('sans_poisson') && a === 'poisson') &&
    !(input.dietaryExclusions.includes('vegetarien') && a === 'poisson')
  );
}

// The allergen-focus card scans the WHOLE catalog by allergenType, not a role pool, so it uses
// THIS predicate rather than safeForRole — which means it must repeat every role-independent
// safety gate safeForRole applies, or an un-safe food slips onto the card. Charcuterie (Jambon)
// is never a protéine AND never card-eligible. FAT_EXCLUDE is defence-in-depth: no allergen-
// tagged food is matieres_grasses today except the already-FAT_EXCLUDEd nut oil, but this must
// never let butter (or any future fat) surface as an allergen-focus food.
function catalogSafe(f: Food, input: MenuInput): boolean {
  return safeFood(f, input) && !CHARCUTERIE(f) && !FAT_EXCLUDE.includes(f.name);
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

// Resolve the day's allergen-focus card. An allergen due for introduction always wins and is
// card-only (meal slots never carry an un-introduced priority allergen — see slotEligible);
// otherwise an already-introduced allergen is maintained on the card.
function applyAllergenFocus(base: Menu, input: MenuInput): void {
  const dueFood = pickDueAllergenFood(input);
  if (dueFood) {
    base.allergenFocus = { food: dueFood, mode: 'introduce', caution: cautionFor(dueFood) };
    return;
  }
  const maintainFood = pickMaintainAllergenFood(input);
  if (maintainFood)
    base.allergenFocus = {
      food: maintainFood,
      mode: 'maintain',
      caution: cautionFor(maintainFood)
    };
}

// Intra-day dedup: when a later slot would repeat an earlier slot's food (novelty or not —
// there's no single sacred novelty anymore), swap it for an alternate from its slot pool.
function dedupSlot(
  slot: MenuItem,
  meal: Meal,
  input: MenuInput,
  quantities: StageQuantities,
  seen: Set<number>
): void {
  if (seen.has(slot.food.id)) {
    const alt = rotatePick(
      slotPool(slot.role, input).filter((f) => !seen.has(f.id)),
      `${input.childId}:${meal.id}:${slot.role}:dedup`,
      input.dayIndex
    );
    if (alt) {
      slot.food = alt;
      slot.caution = cautionFor(alt);
      slot.allergenType = alt.allergenType;
      slot.isNew = !input.introducedFoodIds.has(alt.id); // re-badge for the RESOLVED food
      // Re-derive the hint from the NEW food: dessert's hint depends on the
      // resolved food's category (fruit vs laitier), so a swap that crosses
      // categories must not leave the replaced food's stale hint behind.
      slot.amountHint = amountFor(slot.role, quantities, alt);
    }
  }
  seen.add(slot.food.id);
}

function dedupMealItems(base: Menu, input: MenuInput): void {
  const seen = new Set<number>();
  for (const meal of base.meals) {
    for (const slot of meal.items) dedupSlot(slot, meal, input, base.quantities, seen);
    meal.label = meal.items.map((i) => i.food.name).join(' · ');
  }
}

// Entry point for the post-assembly pass: allergen focus, then intra-day dedup + middot
// labels. Split into small helpers (rather than inlined here) to stay under fallow's
// per-function complexity gate.
function applyAllergenFocusAndDedup(base: Menu, input: MenuInput): void {
  applyAllergenFocus(base, input);
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
    allergenFocus: null
  };

  // Age branch FIRST (getStageForAgeMonths clamps <4 to '4-6').
  if (input.ageMonths < 4) return base; // zero solids, milk message only

  // Returns BEFORE the full-day assembly + allergen-focus/dedup pass.
  if (stage.id === '4-6') {
    base.meals = buildStarterMeal(input, stage, quantities);
    return base;
  }

  base.meals = assembleFullDayMeals(input, stage, quantities);
  applyAllergenFocusAndDedup(base, input);

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

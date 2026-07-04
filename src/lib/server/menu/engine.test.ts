import { test, expect } from 'bun:test';
import { buildMenu, cautionFor, safeForRole, mkItem, type MenuInput } from './engine';
import { SOFT_CHEESE } from './tables';
import { FOODS_SEED } from '$lib/server/db/seed';

// Build a catalog with stable ids from the seed (id = index+1, isCustom=false).
const CATALOG = FOODS_SEED.map((f, i) => ({
  id: i + 1,
  name: f.name,
  category: f.category,
  isMajorAllergen: f.allergen != null,
  allergenType: f.allergen ?? null,
  suggestedAgeMonths: f.age,
  notes: null,
  isCustom: false,
  customForChildId: null
}));

function baseInput(over: Partial<MenuInput> = {}): MenuInput {
  return {
    childId: 1,
    ageMonths: 8,
    dayIndex: 20638,
    weekday: 0,
    catalog: CATALOG,
    introducedFoodIds: new Set(CATALOG.map((f) => f.id)), // "everything introduced" baseline
    avoidFoodIds: new Set(),
    reactionTierFoodIds: new Set(),
    introducedAllergens: new Set(),
    reactedAllergens: new Set(),
    dietaryExclusions: [],
    ...over
  };
}

test('a 3-month-old gets zero solids', () => {
  const menu = buildMenu(baseInput({ ageMonths: 3 }));
  expect(menu.meals.flatMap((mo) => mo.items)).toHaveLength(0);
});

test('a 4-5 month-old gets a single food', () => {
  const menu = buildMenu(baseInput({ ageMonths: 5 }));
  expect(menu.meals.flatMap((mo) => mo.items)).toHaveLength(1);
});

test('never suggests a food above the child age', () => {
  const menu = buildMenu(baseInput({ ageMonths: 6 }));
  for (const it of menu.meals.flatMap((mo) => mo.items)) {
    expect(it.food.suggestedAgeMonths).toBeLessThanOrEqual(6);
  }
});

test('Jambon is never a protéine at any age', () => {
  const menu = buildMenu(baseInput({ ageMonths: 12 }));
  const proteins = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'proteine');
  expect(proteins.some((p) => p.food.name.includes('Jambon'))).toBe(false);
});

// ---------------------------------------------------------------------------
// Rotation + meal assembly (Task 8)
// ---------------------------------------------------------------------------

test('determinism: same input → deep-equal, order-independent', () => {
  const a = buildMenu(baseInput());
  const shuffled = baseInput({ catalog: [...CATALOG].reverse() });
  expect(buildMenu(shuffled)).toEqual(a);
});

test('no consecutive-day repeat in the midi légume slot (introduced pool large)', () => {
  const prev = buildMenu(baseInput({ dayIndex: 100 }));
  const next = buildMenu(baseInput({ dayIndex: 101 }));
  const leg = (mn: ReturnType<typeof buildMenu>) =>
    mn.meals.find((x) => x.id === 'midi')!.items.find((i) => i.role === 'legume')!.food.id;
  expect(leg(prev)).not.toBe(leg(next));
});

test('fish appears >= 2x incl. one oily over a Mon-Sun week', () => {
  const fishNames: string[] = [];
  for (let w = 0; w < 7; w++) {
    const mn = buildMenu(baseInput({ dayIndex: 100 + w, weekday: w }));
    const p = mn.meals.find((x) => x.id === 'midi')!.items.find((i) => i.role === 'proteine');
    if (p && p.food.category === 'poissons') fishNames.push(p.food.name);
  }
  expect(fishNames.length).toBeGreaterThanOrEqual(2);
  expect(fishNames.some((n) => ['Saumon', 'Sardine', 'Maquereau', 'Truite'].includes(n))).toBe(
    true
  );
});

test('a new account with no introduced foods yields an all-empty menu (à découvrir)', () => {
  const menu = buildMenu(baseInput({ introducedFoodIds: new Set() }));
  expect(menu.meals.flatMap((mo) => mo.items)).toHaveLength(0);
  // meals still exist as empty slots for the 4 templates
  expect(menu.meals.length).toBeGreaterThan(0);
});

test('every raw-milk cheese seed food carries a pasteurised caution', () => {
  for (const name of ['Camembert', 'Chèvre frais', 'Brebis (fromage)']) {
    const food = CATALOG.find((f) => f.name === name)!;
    expect(cautionFor(food)).toContain('pasteurisé');
  }
});

test('every SOFT_CHEESE name still matches a seed food (rename-drift guard)', () => {
  // If a seed cheese is renamed without updating SOFT_CHEESE, the caution silently vanishes.
  const seedNames = new Set(FOODS_SEED.map((f) => f.name));
  for (const name of SOFT_CHEESE) expect(seedNames.has(name)).toBe(true);
});

// ---------------------------------------------------------------------------
// safeForRole — exported "for unit tests": buildMenu doesn't call it yet
// (rotation/assembly lands in Task 8), so it needs direct coverage here to
// reach 100% line coverage on engine.ts.
// ---------------------------------------------------------------------------

test('safeForRole(proteine) excludes charcuterie and is sorted ascending by id', () => {
  const result = safeForRole('proteine', baseInput());
  expect(result.length).toBeGreaterThan(0);
  expect(result.some((f) => f.name.includes('Jambon'))).toBe(false);
  const ids = result.map((f) => f.id);
  expect(ids).toEqual([...ids].sort((a, b) => a - b));
});

test('safeForRole(matiereGrasse) excludes the nut oil', () => {
  const result = safeForRole('matiereGrasse', baseInput());
  expect(result.length).toBeGreaterThan(0);
  expect(result.some((f) => f.name === 'Huile de noix')).toBe(false);
});

test('vegetarien excludes viandes and poissons from the protéine pool', () => {
  const result = safeForRole('proteine', baseInput({ dietaryExclusions: ['vegetarien'] }));
  expect(result.length).toBeGreaterThan(0); // légumineuses/œufs remain
  expect(result.some((f) => f.category === 'viandes' || f.category === 'poissons')).toBe(false);
});

test('sans_poisson excludes poissons only', () => {
  const result = safeForRole('proteine', baseInput({ dietaryExclusions: ['sans_poisson'] }));
  expect(result.some((f) => f.category === 'poissons')).toBe(false);
  expect(result.some((f) => f.name === 'Poulet')).toBe(true); // viandes untouched
});

test('porc excludes Porc and Jambon foods', () => {
  const withoutExclusion = safeForRole('proteine', baseInput());
  expect(withoutExclusion.some((f) => f.name === 'Porc')).toBe(true); // control: present normally

  const result = safeForRole('proteine', baseInput({ dietaryExclusions: ['porc'] }));
  expect(result.some((f) => f.name === 'Porc')).toBe(false);
  expect(result.some((f) => f.name.includes('Jambon'))).toBe(false);
});

test('safeForRole excludes avoided, reacted-allergen, and reaction-tier foods', () => {
  const carotte = CATALOG.find((f) => f.name === 'Carotte')!;
  const celeriRave = CATALOG.find((f) => f.name === 'Céleri-rave')!;
  const brocoli = CATALOG.find((f) => f.name === 'Brocoli')!;

  const result = safeForRole(
    'legume',
    baseInput({
      avoidFoodIds: new Set([carotte.id]),
      reactedAllergens: new Set([celeriRave.allergenType!]),
      reactionTierFoodIds: new Set([brocoli.id])
    })
  );

  const names = result.map((f) => f.name);
  expect(names).not.toContain('Carotte'); // avoidFoodIds, not on the reaction tier
  expect(names).not.toContain('Céleri-rave'); // allergenType present in reactedAllergens
  expect(names).not.toContain('Brocoli'); // reactionTierFoodIds
  expect(names).toContain('Patate douce'); // untouched control
});

test('safeForRole excludes foods above the given age', () => {
  const result = safeForRole('legume', baseInput({ ageMonths: 6 }));
  expect(result.length).toBeGreaterThan(0);
  for (const f of result) expect(f.suggestedAgeMonths).toBeLessThanOrEqual(6);
});

test('safeForRole excludes an age-gated forbidden-name match (miel before 12 months)', () => {
  // FORBIDDEN_FOODS' only untilMonths+nameMatchers entry is 'miel'; no seed food
  // is named that way (a custom "miel" food would also be dropped by the
  // isCustom filter first), so this exercises forbiddenAtAge's match branch
  // directly with a synthetic-but-structurally-real Food row.
  const banane = CATALOG.find((f) => f.name === 'Banane')!;
  const mielFood = { ...banane, id: 9001, name: 'Compote à la pomme et au miel' };
  const result = safeForRole('fruit', baseInput({ catalog: [...CATALOG, mielFood] }));
  expect(result.some((f) => f.id === 9001)).toBe(false);
});

// ---------------------------------------------------------------------------
// mkItem — exported "for unit tests": buildMenu doesn't call it yet.
// ---------------------------------------------------------------------------

test('mkItem builds a MenuItem with role/food/amountHint/texture/isNew and a caution', () => {
  const carotte = CATALOG.find((f) => f.name === 'Carotte')!;
  const item = mkItem('legume', carotte, 'Purée lisse', '~130 g', false);
  expect(item.role).toBe('legume');
  expect(item.food).toBe(carotte);
  expect(item.amountHint).toBe('~130 g');
  expect(item.texture).toBe('Purée lisse');
  expect(item.isNew).toBe(false);
  expect(item.allergenType).toBe(carotte.allergenType);
  expect(item.caution).toBe(cautionFor(carotte));
  expect(item.caution).toContain('fondant'); // Carotte carries a CHOKING_BY_FOOD entry
});

// ---------------------------------------------------------------------------
// cautionFor branches
// ---------------------------------------------------------------------------

test('cautionFor: poissons and viandes get a category caution; a plain fruit gets none', () => {
  const sole = CATALOG.find((f) => f.name === 'Sole')!;
  const poulet = CATALOG.find((f) => f.name === 'Poulet')!;
  const banane = CATALOG.find((f) => f.name === 'Banane')!;
  expect(cautionFor(sole)).toContain('arêtes');
  expect(cautionFor(poulet)).toMatch(/Haché|morceaux/);
  expect(cautionFor(banane)).toBeNull();
});

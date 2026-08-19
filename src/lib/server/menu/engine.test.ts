import { test, expect } from 'bun:test';
import { buildMenu, cautionFor, safeForRole, mkItem, type MenuInput } from './engine';
import { SOFT_CHEESE, OILY_FISH } from './tables';
import { FOODS_SEED } from '$lib/server/db/seed';
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

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

// Shared by several tests below: every food introduced except the whole légumes category (not
// a priority-allergen category), so the légume role always has exactly the un-introduced whole
// légumes pool to draw a "Nouveauté"-badged pick from.
function introExceptLegumes(): Set<number> {
  return new Set(CATALOG.filter((f) => f.category !== 'legumes').map((f) => f.id));
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

test('all 4 oily fish are reachable on the fixed oily weekday across enough weeks', () => {
  // Regression guard: on a FIXED weekday, an occurrence-counter index has fixed
  // parity, so `occ % list.length` only ever hits half an even-sized pool (2 of
  // 4 oily fish, forever). rotatePick's index strides by dayIndex (steps of 7
  // across weeks) mod n, which is coprime with 7 for every realistic pool size
  // (n=4 here), so the whole pool cycles.
  const seen = new Set<string>();
  for (let w = 0; w < 8; w++) {
    const dayIndex = 1 + w * 7; // weekday=1 (the oily day) fixed; dayIndex strides by 7
    const menu = buildMenu(baseInput({ dayIndex, weekday: 1 }));
    const p = menu.meals.find((mo) => mo.id === 'midi')!.items.find((i) => i.role === 'proteine');
    if (p) seen.add(p.food.name);
  }
  for (const name of OILY_FISH) expect(seen.has(name)).toBe(true);
});

test('a new account with no introduced foods still fills non-allergen slots, badged Nouveauté', () => {
  // Full-variety: slots draw from the whole safe catalog, not just introduced foods, so a
  // brand-new account is no longer an all-empty menu — only priority-allergen-only
  // categories (fully un-introduced) stay gated to "à découvrir". produits_laitiers is shrunk
  // to Yaourt nature ALONE: it's the sole (un-introduced, 'lait'-tagged) laitier candidate, so
  // if slotEligible's allergen clause were disabled it would be FORCED into the matin/gouter
  // laitier slot — a bigger dairy pool would let rotatePick just dodge it by chance.
  const yaourt = CATALOG.find((f) => f.name === 'Yaourt nature')!;
  const catalog = CATALOG.filter((f) => f.category !== 'produits_laitiers' || f.id === yaourt.id);
  const menu = buildMenu(
    baseInput({ catalog, introducedFoodIds: new Set(), introducedAllergens: new Set() })
  );
  const items = menu.meals.flatMap((mo) => mo.items);
  expect(items.length).toBeGreaterThan(0);
  for (const i of items) expect(i.isNew).toBe(true); // nothing is introduced yet
  // defense-in-depth: the sole un-introduced priority-allergen candidate never fills a slot —
  // it stays gated to the allergène-du-jour card instead.
  expect(items.some((i) => i.food.id === yaourt.id)).toBe(false);
});

test('every raw-milk cheese seed food carries a pasteurised caution', () => {
  for (const name of SOFT_CHEESE) {
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

test('safeForRole(matiereGrasse) allows nut oil without using it as an allergen exposure', () => {
  const result = safeForRole('matiereGrasse', baseInput());
  expect(result.length).toBeGreaterThan(0);
  const oil = result.find((f) => f.name === 'Huile de noix');
  expect(oil).toBeDefined();
  expect(oil?.allergenType).toBeNull();
});

test('vegetarien excludes viandes and poissons but keeps eggs and legumes in the protéine pool', () => {
  const result = safeForRole('proteine', baseInput({ dietaryExclusions: ['vegetarien'] }));
  expect(result.some((f) => f.category === 'oeufs')).toBe(true);
  expect(result.some((f) => f.category === 'legumineuses')).toBe(true);
  expect(result.some((f) => f.category === 'viandes' || f.category === 'poissons')).toBe(false);
});

test('vegetarien with egg symptoms gets a legume protein without a meat/fish/egg gram hint', () => {
  const menu = buildMenu(
    baseInput({ dietaryExclusions: ['vegetarien'], reactedAllergens: new Set(['oeuf']) })
  );
  const protein = menu.meals
    .find((meal) => meal.id === 'midi')
    ?.items.find((item) => item.role === 'proteine');

  expect(protein?.food.category).toBe('legumineuses');
  expect(protein?.amountHint).toBeNull();
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
  expect(names).toContain('Courgette (épluchée, épépinée)'); // untouched control
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

test('menu fat slots add up to the daily stage amount', () => {
  const infant = buildMenu({ ...baseInput(), ageMonths: 8 });
  const toddler = buildMenu({ ...baseInput(), ageMonths: 18 });
  const fatHints = (menu: ReturnType<typeof buildMenu>) =>
    menu.meals.flatMap((meal) => meal.items).filter((item) => item.role === 'matiereGrasse');

  expect(fatHints(infant).map((item) => item.amountHint)).toEqual(['1 c. à café']);
  expect(fatHints(toddler).map((item) => item.amountHint)).toEqual(['1 c. à café', '1 c. à café']);
});

test('toddler daily starch allowance stays in totals instead of repeating on every meal', () => {
  const menu = buildMenu({ ...baseInput(), ageMonths: 18 });
  const starches = menu.meals
    .flatMap((meal) => meal.items)
    .filter((item) => item.role === 'feculent');

  expect(starches.length).toBeGreaterThan(1);
  expect(starches.every((item) => item.amountHint === null)).toBe(true);
  expect(menu.quantities.portions.feculent).toBe('3–4 c. à soupe/jour');
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

// ---------------------------------------------------------------------------
// Full-variety slots + THE allergen safety gate (most important test in this
// file — see full-variety-brief.md). Meal slots now draw from the whole
// age-appropriate safe catalog, badging an un-introduced pick "Nouveauté" —
// EXCEPT an un-introduced priority allergen, which stays gated to the
// allergène-du-jour card. There is no single proactive novelty anymore.
// ---------------------------------------------------------------------------

test('THE safety gate: an un-introduced priority-allergen food never appears in a meal slot', () => {
  // 'oeufs' is 100%-tagged allergenType 'oeuf' in the seed, and 'oeuf' is a
  // priority allergen. weekday=3 is PROTEIN_WEEK's 'oeufs' day, so — absent
  // slotEligible's allergen clause — pickProtein's weekday-category branch
  // would draw straight from the (un-introduced) œuf foods.
  const oeufFoods = CATALOG.filter((f) => f.allergenType === 'oeuf');
  expect(oeufFoods.length).toBeGreaterThan(0);
  const intro = new Set(CATALOG.filter((f) => f.allergenType !== 'oeuf').map((f) => f.id));
  const introducedAllergens = new Set(PRIORITY_INTRODUCTION_ALLERGENS.filter((a) => a !== 'oeuf'));
  const menu = buildMenu(baseInput({ introducedFoodIds: intro, introducedAllergens, weekday: 3 }));
  const slotFoodIds = new Set(menu.meals.flatMap((mo) => mo.items).map((i) => i.food.id));
  for (const f of oeufFoods) expect(slotFoodIds.has(f.id)).toBe(false);
  // Sanity: the scenario is non-vacuous — oeuf IS due, and surfaces card-only.
  expect(menu.allergenFocus?.food.allergenType).toBe('oeuf');
});

test('an un-introduced non-allergen food fills a slot directly, badged Nouveauté', () => {
  // Only the légumes category (never a priority allergen) is un-introduced: both the midi
  // and soir légume slots draw directly from the whole légumes catalog and get badged —
  // there's no single sacred novelty anymore, so more than one slot may be new in a day.
  const intro = introExceptLegumes();
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  const items = menu.meals.flatMap((mo) => mo.items);
  const badged = items.filter((i) => i.isNew);
  expect(badged.length).toBe(2); // midi + soir légume — the only role touching that category
  for (const i of badged) {
    expect(i.food.category).toBe('legumes');
    expect(intro.has(i.food.id)).toBe(false);
  }
  for (const i of items) if (!badged.includes(i)) expect(intro.has(i.food.id)).toBe(true);
});

// ---------------------------------------------------------------------------
// Allergen-focus card: due → introduce, else → maintain. Unchanged by the
// full-variety change other than dropping noveltyFoodId, which it used to set.
// ---------------------------------------------------------------------------

test('orphan allergen (arachide) is card-only, never a meal slot', () => {
  const peanut = CATALOG.find((f) => f.allergenType === 'arachide')!;
  const intro = new Set(CATALOG.filter((f) => f.id !== peanut.id).map((f) => f.id));
  const introAll = new Set(PRIORITY_INTRODUCTION_ALLERGENS.filter((a) => a !== 'arachide'));
  const menu = buildMenu(baseInput({ introducedFoodIds: intro, introducedAllergens: introAll }));
  expect(menu.allergenFocus?.food.allergenType).toBe('arachide');
  expect(menu.allergenFocus?.mode).toBe('introduce');
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.id === peanut.id)).toBe(false);
});

test("allergenFocus carries the food's prep/choking caution (never skips cautionFor)", () => {
  // 'poisson' is the sole due priority allergen; ANY catalogSafe poissons-category
  // food carries the "Bien cuit, sans arêtes." category caution via cautionFor —
  // the allergenFocus card must surface it, like every other food-surfacing path.
  const intro = new Set(CATALOG.filter((f) => f.category !== 'poissons').map((f) => f.id));
  const introducedAllergens = new Set(
    PRIORITY_INTRODUCTION_ALLERGENS.filter((a) => a !== 'poisson')
  );
  const menu = buildMenu(baseInput({ introducedFoodIds: intro, introducedAllergens }));
  expect(menu.allergenFocus?.mode).toBe('introduce');
  expect(menu.allergenFocus?.food.category).toBe('poissons');
  expect(menu.allergenFocus?.caution).toBe(cautionFor(menu.allergenFocus!.food));
  expect(menu.allergenFocus?.caution).toContain('arêtes');
});

test('charcuterie (Jambon) is never surfaced as a protéine, even un-introduced', () => {
  // Shrink every protéine-pool category (viandes/poissons/oeufs/legumineuses) down to Jambon
  // ALONE: it's the SOLE protéine candidate, so if safeForRole's CHARCUTERIE exclusion were
  // deleted it would be FORCED into the slot — a bigger pool would let rotatePick dodge it and
  // pass by luck even with the exclusion gone.
  const jambon = CATALOG.find((f) => f.name.includes('Jambon'))!;
  const proteineCats = new Set(['viandes', 'poissons', 'oeufs', 'legumineuses']);
  const catalog = CATALOG.filter((f) => !proteineCats.has(f.category) || f.id === jambon.id);
  const intro = new Set(catalog.filter((f) => f.id !== jambon.id).map((f) => f.id));
  const menu = buildMenu(baseInput({ catalog, introducedFoodIds: intro }));
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.id === jambon.id)).toBe(false);
  const proteins = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'proteine');
  expect(proteins.some((p) => p.food.name.includes('Jambon'))).toBe(false);
});

test('reaction to Saumon blocks all poisson', () => {
  const saumon = CATALOG.find((f) => f.name === 'Saumon')!;
  const menu = buildMenu(
    baseInput({
      reactionTierFoodIds: new Set([saumon.id]),
      avoidFoodIds: new Set([saumon.id]),
      reactedAllergens: new Set(['poisson'])
    })
  );
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.category === 'poissons')).toBe(
    false
  );
});

test('allergenFocus.maintain re-offers only an introduced food', () => {
  // Every priority allergen is already introduced (dueList is empty), so
  // pickDueAllergenFood always returns null and the maintain branch is the ONLY
  // path that can populate allergenFocus — deterministic, not conditional on it.
  const intro = new Set(CATALOG.map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  expect(menu.allergenFocus?.mode).toBe('maintain');
  expect(intro.has(menu.allergenFocus!.food.id)).toBe(true);
});

test('sans_poisson never shows poisson as allergène du jour', () => {
  const menu = buildMenu(
    baseInput({ dietaryExclusions: ['sans_poisson'], introducedAllergens: new Set() })
  );
  // Non-null pins down that a real substitute allergen was surfaced, not an
  // accidental null the `.food.allergenType` check below would pass vacuously.
  expect(menu.allergenFocus).not.toBeNull();
  expect(menu.allergenFocus?.food.allergenType).not.toBe('poisson');
});

test('a reaction-tier food is never surfaced in a meal slot, even though otherwise slot-eligible', () => {
  // defense-in-depth: a genuine reaction must never be re-offered. Shrink the légumes category
  // to Carotte ALONE so it's the SOLE légume candidate — a bigger pool would let rotatePick
  // simply dodge Carotte by chance, passing even if the reaction-tier exclusion were deleted.
  const carotte = CATALOG.find((f) => f.name === 'Carotte')!; // no allergenType
  const catalog = CATALOG.filter((f) => f.category !== 'legumes' || f.id === carotte.id);
  const intro = new Set(catalog.filter((f) => f.id !== carotte.id).map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      catalog,
      introducedFoodIds: intro,
      reactionTierFoodIds: new Set([carotte.id]) // deliberately NOT in avoidFoodIds
    })
  );
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.id === carotte.id)).toBe(false);
});

test('a due allergen with no safe catalog food falls through to maintain, slots stay full-variety', () => {
  // arachide is due, but its one catalog food is on the avoid list → catalogSafe rejects it →
  // pickDueAllergenFood returns null, and the flow must fall through to the maintain branch
  // instead of leaving the day with no allergen card.
  const peanut = CATALOG.find((f) => f.allergenType === 'arachide')!;
  const introAll = new Set(PRIORITY_INTRODUCTION_ALLERGENS.filter((a) => a !== 'arachide'));
  const intro = introExceptLegumes();
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: introAll,
      avoidFoodIds: new Set([peanut.id])
    })
  );
  expect(menu.allergenFocus?.food.allergenType).not.toBe('arachide');
  expect(menu.allergenFocus?.mode).toBe('maintain');
  // légumes is the only wholly-un-introduced (non-allergen) category: BOTH midi's and soir's
  // légume slots fill directly from it, badged — neither is left as an empty discover prompt.
  const badgedLegumes = menu.meals
    .flatMap((mo) => mo.items)
    .filter((i) => i.isNew && i.food.category === 'legumes');
  expect(badgedLegumes.length).toBe(2);
  expect(menu.meals.find((mo) => mo.id === 'midi')!.discoverRoles).not.toContain('legume');
  expect(menu.meals.find((mo) => mo.id === 'soir')!.discoverRoles).not.toContain('legume');
});

test('an introduced allergen with no matching introduced food yields no maintain card, but its other foods are ordinary novelties', () => {
  // Every priority-allergen-tagged food is un-introduced, even though all 7 allergens are
  // flagged introduced at the tracking level → pickMaintainAllergenFood finds no INDIVIDUAL
  // introduced food for any candidate allergen, so allergenFocus stays null. But slotEligible
  // only gates a food until its ALLERGEN's first exposure — once introducedAllergens already
  // has it, other un-introduced foods of that same allergen are ordinary slot novelties, not
  // held back for the card.
  const priority: readonly string[] = PRIORITY_INTRODUCTION_ALLERGENS;
  const allergenFoodIds = new Set(
    CATALOG.filter((f) => f.allergenType && priority.includes(f.allergenType)).map((f) => f.id)
  );
  const intro = new Set(CATALOG.filter((f) => !allergenFoodIds.has(f.id)).map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  expect(menu.allergenFocus).toBeNull();
  const badged = menu.meals.flatMap((mo) => mo.items).filter((i) => i.isNew);
  expect(badged.length).toBeGreaterThan(0);
  for (const i of badged) {
    expect(i.food.allergenType).not.toBeNull();
    expect(priority.includes(i.food.allergenType!)).toBe(true); // its allergen is already "introduced"
    expect(intro.has(i.food.id)).toBe(false); // yet this specific food isn't
  }
});

// ---------------------------------------------------------------------------
// Intra-day dedup: a later slot repeating an earlier slot's food gets swapped for an
// alternate from its full slot pool (not introduced-only anymore), and isNew is re-badged
// for whichever food the slot resolves to.
// ---------------------------------------------------------------------------

test('a same-day duplicate pick is swapped for an alternate from the slot pool, re-badging isNew', () => {
  // Catalog shrunk to exactly 2 légumes: rotatePick's index depends only on the pool's SIZE
  // (not which foods occupy it), so midi and soir's légume slots are known — via the same
  // rotation hash as before the full-variety change — to land on the SAME food initially,
  // forcing the dedup pass to swap the later (soir) one for the other. Only Courgette is
  // introduced, so the swap must also re-badge isNew for whichever food ends up where.
  const carotte = CATALOG.find((f) => f.name === 'Carotte')!;
  const courgette = CATALOG.find((f) => f.name === 'Courgette (épluchée, épépinée)')!;
  const legumeIds = new Set([carotte.id, courgette.id]);
  const catalog = CATALOG.filter((f) => f.category !== 'legumes' || legumeIds.has(f.id));
  const intro = new Set([
    ...catalog.filter((f) => f.category !== 'legumes').map((f) => f.id),
    courgette.id
  ]);
  const menu = buildMenu(baseInput({ catalog, introducedFoodIds: intro }));
  const midiLegume = menu.meals
    .find((m) => m.id === 'midi')!
    .items.find((i) => i.role === 'legume')!;
  const soirLegume = menu.meals
    .find((m) => m.id === 'soir')!
    .items.find((i) => i.role === 'legume')!;
  expect(midiLegume.food.id).not.toBe(soirLegume.food.id); // swapped, not a silent repeat
  expect(new Set([midiLegume.food.id, soirLegume.food.id])).toEqual(
    new Set([carotte.id, courgette.id])
  );
  for (const item of [midiLegume, soirLegume]) {
    expect(item.isNew).toBe(item.food.id === carotte.id); // re-badged for the RESOLVED food
  }
});

test('a same-day duplicate with no remaining alternate is left as-is', () => {
  // Catalog shrunk to exactly 1 légume: midi and soir both resolve to it (it's the only
  // candidate, full stop), and no alternate exists once it's already "seen" — the dedup pass
  // must leave the repeat rather than blank the slot.
  const carotte = CATALOG.find((f) => f.name === 'Carotte')!;
  const catalog = CATALOG.filter((f) => f.category !== 'legumes' || f.id === carotte.id);
  const menu = buildMenu(baseInput({ catalog, introducedFoodIds: new Set() }));
  const midiLegume = menu.meals
    .find((m) => m.id === 'midi')!
    .items.find((i) => i.role === 'legume')!;
  const soirLegume = menu.meals
    .find((m) => m.id === 'soir')!
    .items.find((i) => i.role === 'legume')!;
  expect(midiLegume.food.id).toBe(carotte.id);
  expect(soirLegume.food.id).toBe(carotte.id);
  expect(midiLegume.isNew).toBe(true); // un-introduced, and the repeat is left untouched
  expect(soirLegume.isNew).toBe(true);
});

test("a dessert's amount hint follows its resolved food category after dedup", () => {
  // Catalog shrunk to 2 fruits (Pomme, Poire) so the fruit/dessert pools stay exactly the size
  // they were pre-full-variety; only Yaourt nature is introduced among produits_laitiers (the
  // rest are un-introduced 'lait' and stay gated by slotEligible, just like the old introduced-
  // only pool). matin's laitier/fruit slots consume Yaourt nature and Poire first, so by the
  // time midi's dessert slot is deduped, its initial (dairy) pick is already "seen" and gets
  // swapped for Pomme — a cross-category (dairy→fruit) swap. Known via the rotation hash at
  // baseInput()'s default childId/dayIndex/weekday (rotatePick's index depends only on pool
  // size, not on which specific foods occupy it, so shrinking the catalog this way reproduces
  // the exact same collision as before the full-variety change).
  const pomme = CATALOG.find((f) => f.name === 'Pomme')!;
  const poire = CATALOG.find((f) => f.name === 'Poire')!;
  const yaourt = CATALOG.find((f) => f.name === 'Yaourt nature')!;
  const catalog = CATALOG.filter(
    (f) => f.category !== 'fruits' || f.id === pomme.id || f.id === poire.id
  );
  const nonDessert = catalog
    .filter((f) => f.category !== 'fruits' && f.category !== 'produits_laitiers')
    .map((f) => f.id);
  const intro = new Set([...nonDessert, pomme.id, poire.id, yaourt.id]);
  const menu = buildMenu(baseInput({ catalog, introducedFoodIds: intro }));
  const midiDessert = menu.meals
    .find((m) => m.id === 'midi')!
    .items.find((i) => i.role === 'dessert')!;
  const expected =
    midiDessert.food.category === 'fruits'
      ? menu.quantities.portions.fruit
      : menu.quantities.portions.laitier;
  expect(midiDessert.amountHint).toBe(expected);
});

// ---------------------------------------------------------------------------
// dessert amountHint follows the food's actual category (ROLE_POOLS.dessert =
// fruits ∪ produits_laitiers), not a role-wide laitier default.
// ---------------------------------------------------------------------------

test('a fruit in the dessert slot shows the fruit portion hint, not the laitier one', () => {
  // No produits_laitiers food is introduced, so — since produits_laitiers is wholly
  // 'lait'-tagged and gated by slotEligible — the dessert pool (fruits ∪ produits_laitiers)
  // can only resolve to a fruit.
  const intro = new Set(CATALOG.filter((f) => f.category !== 'produits_laitiers').map((f) => f.id));
  const menu = buildMenu(baseInput({ introducedFoodIds: intro }));
  const dessertItems = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'dessert');
  expect(dessertItems.length).toBeGreaterThan(0);
  for (const item of dessertItems) {
    expect(item.food.category).toBe('fruits');
    expect(item.amountHint).toBe(menu.quantities.portions.fruit);
  }
});

test('a dairy food in the dessert slot shows the laitier portion hint', () => {
  // Fruits removed from the catalog entirely — not just un-introduced, since fruits are never
  // allergen-gated and an un-introduced fruit would still be slot-eligible and could win the
  // dessert pick. With no fruits at all, the dessert pool (fruits ∪ produits_laitiers) can only
  // resolve to an introduced dairy food.
  const catalog = CATALOG.filter((f) => f.category !== 'fruits');
  const menu = buildMenu(
    baseInput({ catalog, introducedFoodIds: new Set(catalog.map((f) => f.id)) })
  );
  const dessertItems = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'dessert');
  expect(dessertItems.length).toBeGreaterThan(0);
  for (const item of dessertItems) {
    expect(item.food.category).toBe('produits_laitiers');
    expect(item.amountHint).toBe(menu.quantities.portions.laitier);
  }
});

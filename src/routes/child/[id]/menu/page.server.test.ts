import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  expectForbidden,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { eq } from 'drizzle-orm';
import { children, foodEntries, foods } from '$lib/server/db/schema';
import type { DietExclusion } from '$lib/utils/diet';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function insertFood(opts: {
  name: string;
  category: string;
  age: number;
  allergen?: string;
}) {
  return (
    await testDb
      .insert(foods)
      .values({
        name: opts.name,
        category: opts.category,
        isMajorAllergen: opts.allergen != null,
        allergenType: opts.allergen ?? null,
        suggestedAgeMonths: opts.age,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
}

async function logEntry(opts: {
  childId: number;
  foodId: number;
  loggedBy: number;
  reaction: 'ras' | 'inconfort' | 'reaction';
}) {
  await testDb.insert(foodEntries).values({
    childId: opts.childId,
    foodId: opts.foodId,
    givenAt: new Date(),
    reaction: opts.reaction,
    notes: null,
    loggedBy: opts.loggedBy,
    createdAt: new Date()
  });
}

async function setDiet(childId: number, exclusions: DietExclusion[]) {
  await testDb
    .update(children)
    .set({ dietaryExclusions: exclusions })
    .where(eq(children.id, childId));
}

async function setup() {
  const u = await seedUser();
  // ~8 months old : lands in the '6-9' stage, which uses the full-day meal
  // templates (matin/midi/goûter/soir) rather than the 4-6 single-food branch.
  const birth = new Date();
  birth.setMonth(birth.getMonth() - 8);
  const dateStr = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`;
  const c = await seedChild({ createdBy: u.id, birthDate: dateStr });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  return { u, c, m };
}

function loadFor({ u, c, m }: Awaited<ReturnType<typeof setup>>) {
  return load(
    makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    }) as unknown as Parameters<typeof load>[0]
  );
}

describe('child/[id]/menu load', () => {
  it('assembles a non-empty menu, defaults dietaryExclusions, and never serves a reacted food', async () => {
    const ctx = await setup();

    // One introduced, reaction-free food per meal-role category so every slot
    // in the 6-9 full-day templates (legume/proteine/feculent/fruit/laitier/
    // matiereGrasse) has a safe candidate.
    const carotte = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const poulet = await insertFood({ name: 'Poulet', category: 'viandes', age: 6 });
    const riz = await insertFood({ name: 'Riz', category: 'feculents', age: 6 });
    const pomme = await insertFood({ name: 'Pomme', category: 'fruits', age: 4 });
    const yaourt = await insertFood({ name: 'Yaourt', category: 'produits_laitiers', age: 6 });
    const huile = await insertFood({
      name: "Huile d'olive",
      category: 'matieres_grasses',
      age: 6
    });
    // A food WITH an allergenType logged at the 'reaction' tier exercises every
    // branch of the loader's aggregation loop in one entry: introducedAllergens
    // (has an allergenType), avoidFoodIds (reaction >= inconfort),
    // reactionTierFoodIds (reaction >= reaction), and reactedAllergens (that
    // reaction-tier entry also has an allergenType). It's a proteine-role food
    // (oeufs), so excluding it is a real, observable behavior — not vacuous.
    const oeuf = await insertFood({ name: 'Œuf', category: 'oeufs', age: 6, allergen: 'oeuf' });

    for (const food of [carotte, poulet, riz, pomme, yaourt, huile]) {
      await logEntry({ childId: ctx.c.id, foodId: food.id, loggedBy: ctx.u.id, reaction: 'ras' });
    }
    await logEntry({
      childId: ctx.c.id,
      foodId: oeuf.id,
      loggedBy: ctx.u.id,
      reaction: 'reaction'
    });

    const out = await loadFor(ctx);

    expect(typeof out.ageMonths).toBe('number');

    const items = out.menu.meals.flatMap((meal) => meal.items);
    expect(items.length).toBeGreaterThan(0);

    // Reaction avoidance is actually wired through the engine: the reacted
    // allergen food never appears in any assembled meal slot.
    expect(items.some((i) => i.food.id === oeuf.id)).toBe(false);

    // No dietaryExclusions set for this child (column defaults to []), so
    // nothing diet-filters the catalog — a 'vegetarien' exclusion would have
    // dropped every viandes food, so Poulet surviving proves no filtering ran.
    expect(items.some((i) => i.food.id === poulet.id)).toBe(true);
  });

  it('excludes an inconfort-tier food from its meal slot (avoidFoodIds population)', async () => {
    const ctx = await setup();

    // Fill every meal role EXCEPT feculent with a reaction-free introduced food,
    // so the assembled menu stays non-empty whether or not the feculent slot fills.
    const carotte = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const poulet = await insertFood({ name: 'Poulet', category: 'viandes', age: 6 });
    const pomme = await insertFood({ name: 'Pomme', category: 'fruits', age: 4 });
    const yaourt = await insertFood({ name: 'Yaourt', category: 'produits_laitiers', age: 6 });
    const huile = await insertFood({ name: "Huile d'olive", category: 'matieres_grasses', age: 6 });
    for (const food of [carotte, poulet, pomme, yaourt, huile]) {
      await logEntry({ childId: ctx.c.id, foodId: food.id, loggedBy: ctx.u.id, reaction: 'ras' });
    }

    // The SOLE introduced feculent, with NO allergenType, logged at 'inconfort'.
    // It is dropped from safeForRole('feculent') ONLY by the loader's
    // `avoidFoodIds.add(e.foodId)` line: it has no allergenType (so the
    // reactedAllergens gate can't touch it) and inconfort < reaction (so the
    // reactionTierFoodIds gate can't touch it either). This makes the test a
    // targeted, non-flaky guard for that one line, independent of parisDay's
    // real dayIndex:
    //   WITH avoidFoodIds populated → feculent pool empty → slot skipped → absent every day.
    //   WITHOUT it → sole introduced feculent → picked in every feculent slot → present.
    // (It's introduced, so pickNoveltyCandidate — which requires NOT-introduced —
    // can never re-surface it as the day's novelty either.)
    const riz = await insertFood({ name: 'Riz', category: 'feculents', age: 6 });
    await logEntry({
      childId: ctx.c.id,
      foodId: riz.id,
      loggedBy: ctx.u.id,
      reaction: 'inconfort'
    });

    const out = await loadFor(ctx);

    const items = out.menu.meals.flatMap((meal) => meal.items);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.food.id === riz.id)).toBe(false);
  });

  it('vegetarien excludes viandes and poissons from every meal slot', async () => {
    const ctx = await setup();

    // Poulet/Cabillaud are the ONLY introduced protein-pool candidates (viandes/
    // poissons/oeufs/legumineuses), so pickProtein deterministically serves one
    // of them absent diet filtering — proving the exclusion actually runs,
    // rather than relying on a rotation-dependent fluke.
    const poulet = await insertFood({ name: 'Poulet', category: 'viandes', age: 6 });
    const cabillaud = await insertFood({
      name: 'Cabillaud',
      category: 'poissons',
      age: 6,
      allergen: 'poisson'
    });
    const carotte = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const pomme = await insertFood({ name: 'Pomme', category: 'fruits', age: 4 });
    const riz = await insertFood({ name: 'Riz', category: 'feculents', age: 6 });
    const yaourt = await insertFood({ name: 'Yaourt', category: 'produits_laitiers', age: 6 });
    const huile = await insertFood({ name: "Huile d'olive", category: 'matieres_grasses', age: 6 });
    for (const food of [poulet, cabillaud, carotte, pomme, riz, yaourt, huile]) {
      await logEntry({ childId: ctx.c.id, foodId: food.id, loggedBy: ctx.u.id, reaction: 'ras' });
    }
    await setDiet(ctx.c.id, ['vegetarien']);

    const out = await loadFor(ctx);
    const items = out.menu.meals.flatMap((meal) => meal.items);

    expect(items.some((i) => i.food.category === 'viandes' || i.food.category === 'poissons')).toBe(
      false
    );
  });

  it('porc excludes a plain-pork food, not just charcuterie, from the protein slot', async () => {
    const ctx = await setup();

    // 'Porc' mirrors FOODS_SEED's plain-pork entry: matched by PORC_MATCHERS
    // (name includes 'Porc') but NOT by CHARCUTERIE_MATCHERS (only 'Jambon'), so
    // its absence can only be explained by the diet exclusion actually running —
    // never by the unconditional charcuterie filter (a Jambon-only assertion
    // would pass vacuously even with the exclusion still inert). It's the SOLE
    // protein-pool candidate, so pickProtein serves it deterministically absent
    // diet filtering.
    const porc = await insertFood({ name: 'Porc', category: 'viandes', age: 6 });
    const carotte = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    const pomme = await insertFood({ name: 'Pomme', category: 'fruits', age: 4 });
    const riz = await insertFood({ name: 'Riz', category: 'feculents', age: 6 });
    const yaourt = await insertFood({ name: 'Yaourt', category: 'produits_laitiers', age: 6 });
    const huile = await insertFood({ name: "Huile d'olive", category: 'matieres_grasses', age: 6 });
    for (const food of [porc, carotte, pomme, riz, yaourt, huile]) {
      await logEntry({ childId: ctx.c.id, foodId: food.id, loggedBy: ctx.u.id, reaction: 'ras' });
    }
    await setDiet(ctx.c.id, ['porc']);

    const out = await loadFor(ctx);
    const items = out.menu.meals.flatMap((meal) => meal.items);

    expect(items.some((i) => i.food.id === porc.id)).toBe(false);
  });

  it('sans_poisson keeps poisson out of the allergène-du-jour focus', async () => {
    const ctx = await setup();

    // Every OTHER priority allergen is already introduced, so 'poisson' is the
    // sole due allergen absent diet filtering — a deterministic proof,
    // independent of parisDay's real dayIndex/weekday. Cabillaud stays
    // un-introduced so it remains eligible to be (wrongly) picked as the due
    // allergen food while the exclusion is inert.
    const oeuf = await insertFood({ name: 'Œuf', category: 'oeufs', age: 6, allergen: 'oeuf' });
    const arachide = await insertFood({
      name: 'Beurre de cacahuète',
      category: 'allergenes',
      age: 6,
      allergen: 'arachide'
    });
    const lait = await insertFood({
      name: 'Yaourt nature',
      category: 'produits_laitiers',
      age: 6,
      allergen: 'lait'
    });
    const gluten = await insertFood({
      name: 'Pain',
      category: 'feculents',
      age: 6,
      allergen: 'gluten'
    });
    const fruitsACoque = await insertFood({
      name: "Purée d'amande",
      category: 'allergenes',
      age: 6,
      allergen: 'fruits_a_coque'
    });
    const sesame = await insertFood({
      name: 'Tahin',
      category: 'allergenes',
      age: 6,
      allergen: 'sesame'
    });
    await insertFood({ name: 'Cabillaud', category: 'poissons', age: 6, allergen: 'poisson' });
    for (const food of [oeuf, arachide, lait, gluten, fruitsACoque, sesame]) {
      await logEntry({ childId: ctx.c.id, foodId: food.id, loggedBy: ctx.u.id, reaction: 'ras' });
    }
    await setDiet(ctx.c.id, ['sans_poisson']);

    const out = await loadFor(ctx);

    // Non-null pins down that a real substitute (an already-introduced
    // allergen) was surfaced, not an accidental null from an unrelated gap.
    expect(out.menu.allergenFocus).not.toBeNull();
    expect(out.menu.allergenFocus?.food.allergenType).not.toBe('poisson');
  });

  it('rejects a caller who is a member of child A but not child B (cross-child isolation)', async () => {
    // Defense-in-depth: the isolation audit found requireChildContext already
    // enforces this transitively, but a per-handler test locks the invariant
    // against a future refactor that bypasses the guard.
    const ctx = await setup(); // user A, owner of child A

    const ownerB = await seedUser({ email: 'owner-b@example.com' });
    const birth = new Date();
    birth.setMonth(birth.getMonth() - 8);
    const dateStr = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}-${String(birth.getDate()).padStart(2, '0')}`;
    const childB = await seedChild({ createdBy: ownerB.id, birthDate: dateStr });
    await seedMembership({ userId: ownerB.id, childId: childB.id, role: 'owner' });

    // Give child B a real logged food, so a guard bypass would leak an
    // observable entry rather than passing vacuously against an empty menu.
    const carotte = await insertFood({ name: 'Carotte', category: 'legumes', age: 4 });
    await logEntry({
      childId: childB.id,
      foodId: carotte.id,
      loggedBy: ownerB.id,
      reaction: 'ras'
    });

    // Must throw 403 — never fall through to a return carrying child B's menu/entries.
    await expectForbidden(() =>
      load(
        makeRouteEvent({
          user: safeUser(ctx.u),
          memberships: [ctx.m], // user A's own membership is for child A, NOT child B
          params: { id: String(childB.id) },
          parent: async () => ({ child: { id: childB.id, birthDate: dateStr } })
        }) as unknown as Parameters<typeof load>[0]
      )
    );
  });
});

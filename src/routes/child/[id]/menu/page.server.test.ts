import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
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

    // dietaryExclusions defaults to [] (Phase 2 : the column doesn't exist yet)
    // so nothing diet-filters the catalog — a 'vegetarien' exclusion would have
    // dropped every viandes food, so Poulet surviving proves no filtering ran.
    expect(items.some((i) => i.food.id === poulet.id)).toBe(true);
  });
});

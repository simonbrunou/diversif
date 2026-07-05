import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { ALLERGENS } from '$lib/utils/allergens';
import { load, actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = (
    await testDb
      .insert(foods)
      .values({
        name: 'Carotte',
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
  return { u, c, m, food };
}

async function setupThreeFoods() {
  const user = await seedUser();
  const child = await seedChild({ createdBy: user.id });
  const inserted = await testDb
    .insert(foods)
    .values([
      {
        name: 'Carotte',
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      },
      {
        name: 'Pomme',
        category: 'fruits',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      },
      {
        name: 'Riz',
        category: 'feculents',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      }
    ])
    .returning();
  return { user, child, foodIds: inserted.map((f) => f.id) };
}

async function seedAllergenFood(allergenId: string) {
  return (
    await testDb
      .insert(foods)
      .values({
        name: `food-${allergenId}`,
        category: 'allergenes',
        isMajorAllergen: true,
        allergenType: allergenId,
        suggestedAgeMonths: 6,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
}

// Seeds a user + child with 10 of the 12 tracked allergens already introduced
// as separate, already-logged foods : leaves exactly two allergen types
// (the last two in ALLERGENS declaration order) unintroduced, for tests that
// need to cross the "all 12 allergens" finish line with a two-food meal.
async function seedTenAllergensIntroduced() {
  const user = await seedUser();
  const child = await seedChild({ createdBy: user.id });
  const tenIds = ALLERGENS.slice(0, 10).map((a) => a.id);
  for (const id of tenIds) {
    const f = await seedAllergenFood(id);
    await testDb.insert(foodEntries).values({
      childId: child.id,
      foodId: f.id,
      givenAt: new Date('2024-05-01T10:00:00Z'),
      reaction: 'ras',
      notes: null,
      loggedBy: user.id,
      createdAt: new Date()
    });
  }
  return { user, child };
}

// Two brand-new foods carrying the 11th + 12th (final) allergen types, not
// yet logged for any child.
async function twoNewAllergenFoodIds(): Promise<[number, number]> {
  const [idA, idB] = ALLERGENS.slice(10, 12).map((a) => a.id);
  const foodA = await seedAllergenFood(idA);
  const foodB = await seedAllergenFood(idB);
  return [foodA.id, foodB.id];
}

describe('child/[id]/log load', () => {
  it('redirects guests', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: '1' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('returns the food list (global + custom for this child)', async () => {
    const { u, c, m } = await setup();
    // Add a custom food for THIS child + a custom food for ANOTHER child
    const otherChild = await seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    await testDb.insert(foods).values([
      {
        name: 'Mon plat',
        category: 'autre',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 0,
        notes: null,
        isCustom: true,
        customForChildId: c.id
      },
      {
        name: 'Plat ailleurs',
        category: 'autre',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 0,
        notes: null,
        isCustom: true,
        customForChildId: otherChild.id
      }
    ]);
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );
    const names = out.foods.map((f) => f.name);
    expect(names).toContain('Carotte');
    expect(names).toContain('Mon plat');
    expect(names).not.toContain('Plat ailleurs');
  });
});

describe('child/[id]/log default action', () => {
  it('fails when neither foodId nor customFood.name provided', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { givenAt: '2024-06-01T10:00', reaction: 'ras' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('fails when more than 20 foodIds are submitted (array cap)', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        // 21 ids > the schema's max(20). Validation fails before any
        // resolveOrInsertFood round-trip, so the ids need not exist.
        foodId: Array.from({ length: 21 }, (_, i) => String(i + 1)),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/20/);
  });

  it('fails on invalid date string', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: 'not-a-date',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/date/i);
  });

  it('fails when foodId references an inaccessible food', async () => {
    const { u, c, m } = await setup();
    // Create a custom food for a different child
    const other = await seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    const otherFood = (
      await testDb
        .insert(foods)
        .values({
          name: 'Autre',
          category: 'autre',
          isMajorAllergen: false,
          allergenType: null,
          suggestedAgeMonths: 0,
          notes: null,
          isCustom: true,
          customForChildId: other.id
        })
        .returning()
    )[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(otherFood.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/introuvable/i);
  });

  it('logs an entry from the global catalog and redirects', async () => {
    const { u, c, m, food } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(food.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras',
        notes: ' some notes '
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toContain(`/child/${c.id}?logged=1`);
      expect(r.location).toContain('first=1');
      expect(r.location).toContain('categories=1');
      expect(r.location).toContain('prevCategories=0');
    }
    const entries = await testDb.select().from(foodEntries);
    expect(entries.length).toBe(1);
    expect(entries[0].notes).toBe('some notes');
  });

  it('emits the allergen flag when logging an allergen food for the first time', async () => {
    const { u, c, m } = await setup();
    const allergenFood = (
      await testDb
        .insert(foods)
        .values({
          name: 'Beurre de cacahuète',
          category: 'allergenes',
          isMajorAllergen: true,
          allergenType: 'arachide',
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(allergenFood.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toContain('allergen=arachide');
      expect(r.location).not.toContain('allAllergens=1');
      // 'allergenes' counts as a category bucket (only 'autre' is excluded
      // from the dashboard's diversity denominator), so coverage bumps to 1.
      expect(r.location).toContain('categories=1');
      expect(r.location).toContain('prevCategories=0');
    }
  });

  it('emits allAllergens=1 when the 12th and final allergen is introduced', async () => {
    const { u, c, m } = await setup();
    // Seed 11 of the 12 priority allergens as already-introduced.
    const eleven = [
      'gluten',
      'oeuf',
      'lait',
      'arachide',
      'fruits_a_coque',
      'sesame',
      'soja',
      'poisson',
      'crustace',
      'mollusque',
      'celeri'
    ];
    for (const id of eleven) {
      const f = (
        await testDb
          .insert(foods)
          .values({
            name: `food-${id}`,
            category: 'allergenes',
            isMajorAllergen: true,
            allergenType: id,
            suggestedAgeMonths: 6,
            notes: null,
            isCustom: false,
            customForChildId: null
          })
          .returning()
      )[0];
      await testDb.insert(foodEntries).values({
        childId: c.id,
        foodId: f.id,
        givenAt: new Date('2024-05-01T10:00:00Z'),
        reaction: 'ras',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      });
    }
    // Log the 12th: moutarde.
    const moutarde = (
      await testDb
        .insert(foods)
        .values({
          name: 'Moutarde douce',
          category: 'allergenes',
          isMajorAllergen: true,
          allergenType: 'moutarde',
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        foodId: String(moutarde.id),
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toContain('allergen=moutarde');
      expect(r.location).toContain('allAllergens=1');
    }
  });

  it('a meal introducing the final two allergens fires allAllergens', async () => {
    const { user, child } = await seedTenAllergensIntroduced();
    // f11 -> celeri (ALLERGENS[10]), f12 -> moutarde (ALLERGENS[11]).
    const [f11, f12] = await twoNewAllergenFoodIds();
    const ev = makeRouteEvent({
      user: safeUser(user),
      memberships: [await seedMembership({ userId: user.id, childId: child.id })],
      params: { id: String(child.id) },
      formData: {
        // Submit in REVERSE of ALLERGENS order (moutarde before celeri) so the
        // assertion actually discriminates the determinism property: a pick by
        // ALLERGENS declaration order yields celeri; a pick by meal/insertion
        // order would yield moutarde and fail this test.
        foodId: [String(f12), String(f11)],
        givenAt: new Date().toISOString(),
        reaction: 'ras'
      }
    });
    const res = await captureFlow(() =>
      actions.default!(ev as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(res.kind).toBe('redirect');
    if (res.kind === 'redirect') {
      expect(res.location).toContain('allAllergens=1');
      // Earlier in ALLERGENS declaration order wins (celeri before moutarde),
      // regardless of submission order above.
      expect(res.location).toContain('allergen=celeri');
    }
  });

  it('creates a custom food when only customFood.name is provided (and uses "autre" category by default)', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': 'Couscous maison',
        'customFood.category': 'unknown-category',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    const created = (
      await testDb.select().from(foods).where(eq(foods.name, 'Couscous maison')).limit(1)
    )[0];
    expect(created).toBeDefined();
    expect(created!.isCustom).toBe(true);
    expect(created!.customForChildId).toBe(c.id);
    expect(created!.category).toBe('autre');
  });

  it('fails when customFood.name is whitespace-only (no foodId, trimmed empty)', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': '   ',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/aliment/i);
  });

  it('creates a custom food in a known category', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {
        'customFood.name': 'Crêpe',
        'customFood.category': 'feculents',
        givenAt: '2024-06-01T10:00',
        reaction: 'ras'
      }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const created = (await testDb.select().from(foods).where(eq(foods.name, 'Crêpe')).limit(1))[0];
    expect(created!.category).toBe('feculents');
  });

  it('rolls back the custom-food insert when the entry insert fails', async () => {
    const { u, c, m } = await setup();

    // Install a trigger that aborts any food_entries insert whose notes match
    // the sentinel string (SQLite can't ADD a CHECK constraint via ALTER TABLE).
    // The action's transaction routes both the custom-food insert and the entry
    // insert through the same connection, so when the entry insert raises, the
    // surrounding transaction rolls back : exactly what we want to verify.
    testDb.run(
      sql`CREATE TRIGGER tmp_abort_entry BEFORE INSERT ON food_entries
          WHEN NEW.notes = '__simulated_fail__'
          BEGIN SELECT RAISE(ABORT, 'simulated entry-insert failure'); END`
    );

    try {
      const event = makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        formData: {
          'customFood.name': 'Plat unique de test',
          'customFood.category': 'autre',
          givenAt: new Date().toISOString().slice(0, 16),
          reaction: 'ras',
          notes: '__simulated_fail__'
        }
      });

      await expect(
        captureFlow(() =>
          actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
        )
      ).rejects.toThrow();
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS tmp_abort_entry`);
    }

    // Assert: no custom food committed for this child
    const customFoods = await testDb.select().from(foods).where(eq(foods.customForChildId, c.id));
    expect(customFoods).toEqual([]);

    // Assert: no entry committed for this child
    const entries = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id));
    expect(entries).toEqual([]);
  });

  it('logs several foodIds as one meal sharing a mealId', async () => {
    const { user, child, foodIds } = await setupThreeFoods();
    const ev = makeRouteEvent({
      user: safeUser(user),
      memberships: [await seedMembership({ userId: user.id, childId: child.id })],
      params: { id: String(child.id) },
      formData: {
        foodId: foodIds.map(String), // 3 ids
        givenAt: new Date().toISOString(),
        reaction: 'ras'
      }
    });
    await captureFlow(() =>
      actions.default!(ev as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );

    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, child.id));
    expect(rows.length).toBe(3);
    const mealIds = new Set(rows.map((r) => r.mealId));
    expect(mealIds.size).toBe(1);
    expect([...mealIds][0]).not.toBeNull();
  });

  it('logs a single foodId with mealId null (unchanged behaviour)', async () => {
    const { user, child, foodIds } = await setupThreeFoods();
    const ev = makeRouteEvent({
      user: safeUser(user),
      memberships: [await seedMembership({ userId: user.id, childId: child.id })],
      params: { id: String(child.id) },
      formData: { foodId: String(foodIds[0]), givenAt: new Date().toISOString(), reaction: 'ras' }
    });
    await captureFlow(() =>
      actions.default!(ev as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, child.id));
    expect(rows.length).toBe(1);
    expect(rows[0].mealId).toBeNull();
  });

  it('deduplicates a repeated foodId into one row', async () => {
    const { user, child, foodIds } = await setupThreeFoods();
    const ev = makeRouteEvent({
      user: safeUser(user),
      memberships: [await seedMembership({ userId: user.id, childId: child.id })],
      params: { id: String(child.id) },
      formData: {
        foodId: [String(foodIds[0]), String(foodIds[0])],
        givenAt: new Date().toISOString(),
        reaction: 'ras'
      }
    });
    await captureFlow(() =>
      actions.default!(ev as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, child.id));
    expect(rows.length).toBe(1);
  });
});

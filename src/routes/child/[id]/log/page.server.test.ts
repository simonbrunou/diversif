import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function setup() {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id });
  const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = testDb
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
    .all()[0];
  return { u, c, m, food };
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
    const otherChild = seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    testDb
      .insert(foods)
      .values([
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
      ])
      .run();
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
    const other = seedChild({ createdBy: u.id, birthDate: '2023-01-01' });
    const otherFood = testDb
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
      .all()[0];
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
    const entries = testDb.select().from(foodEntries).all();
    expect(entries.length).toBe(1);
    expect(entries[0].notes).toBe('some notes');
  });

  it('emits the allergen flag when logging an allergen food for the first time', async () => {
    const { u, c, m } = await setup();
    const allergenFood = testDb
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
      .all()[0];
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
      const f = testDb
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
        .all()[0];
      testDb
        .insert(foodEntries)
        .values({
          childId: c.id,
          foodId: f.id,
          givenAt: new Date('2024-05-01T10:00:00Z'),
          reaction: 'ras',
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        })
        .run();
    }
    // Log the 12th: moutarde.
    const moutarde = testDb
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
      .all()[0];
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
    const created = testDb.select().from(foods).where(eq(foods.name, 'Couscous maison')).get();
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
    const created = testDb.select().from(foods).where(eq(foods.name, 'Crêpe')).get();
    expect(created!.category).toBe('feculents');
  });

  it('rolls back the custom-food insert when the entry insert fails', async () => {
    const { u, c, m } = await setup();

    // Install a SQLite trigger that aborts any food_entries insert whose notes
    // match the sentinel string. Both `db.insert(...)` and the drizzle `tx.insert(...)`
    // path inside the action's transaction route through the same connection,
    // so the trigger fires regardless of which API the action uses. After the
    // RAISE(ABORT), better-sqlite3 throws and the surrounding transaction
    // rolls back — exactly what we want to verify.
    testDb.run(
      sql`CREATE TRIGGER tmp_abort_entry BEFORE INSERT ON food_entries WHEN NEW.notes = '__simulated_fail__' BEGIN SELECT RAISE(ABORT, 'simulated entry insert failure'); END`
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
      ).rejects.toThrow('simulated entry insert failure');
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS tmp_abort_entry`);
    }

    // Assert: no custom food committed for this child
    const customFoods = testDb.select().from(foods).where(eq(foods.customForChildId, c.id)).all();
    expect(customFoods).toEqual([]);

    // Assert: no entry committed for this child
    const entries = testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id)).all();
    expect(entries).toEqual([]);
  });
});

describe('Idempotency-Key', () => {
  it('same key replay — only one food_entries row, both calls redirect to same location', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'key-replay-1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'key-replay-1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');
    if (r1.kind === 'redirect' && r2.kind === 'redirect') {
      expect(r1.location).toBe(r2.location);
    }

    const count =
      testDb
        .select({ n: sql<number>`count(*)` })
        .from(foodEntries)
        .get()?.n ?? 0;
    expect(count).toBe(1);
  });

  it('different keys, same form — two food_entries rows', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'k-A' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData,
          headers: { 'Idempotency-Key': 'k-B' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');

    const count =
      testDb
        .select({ n: sql<number>`count(*)` })
        .from(foodEntries)
        .get()?.n ?? 0;
    expect(count).toBe(2);
  });

  it('invalid Idempotency-Key (length 101) — returns 400', async () => {
    const { u, c, m, food } = await setup();
    const r = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData: {
            foodId: String(food.id),
            givenAt: '2026-05-07T10:00:00.000Z',
            reaction: 'ras'
          },
          headers: { 'Idempotency-Key': 'x'.repeat(101) }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r.kind).toBe('return');
    if (r.kind === 'return') {
      expect((r.value as { status: number }).status).toBe(400);
    }
  });

  it('same key for different scope — second call returns 409', async () => {
    const { u, food } = await setup();
    const childA = seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const childB = seedChild({ createdBy: u.id, birthDate: '2024-02-01' });
    const mA = seedMembership({ userId: u.id, childId: childA.id, role: 'owner' });
    const mB = seedMembership({ userId: u.id, childId: childB.id, role: 'owner' });

    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [mA, mB],
          params: { id: String(childA.id) },
          formData,
          headers: { 'Idempotency-Key': 'k1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r1.kind).toBe('redirect');

    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [mA, mB],
          params: { id: String(childB.id) },
          formData,
          headers: { 'Idempotency-Key': 'k1' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    expect(r2.kind).toBe('return');
    if (r2.kind === 'return') {
      expect((r2.value as { status: number }).status).toBe(409);
    }
  });

  it('no header — existing behaviour — two calls produce two food_entries rows', async () => {
    const { u, c, m, food } = await setup();
    const formData = {
      foodId: String(food.id),
      givenAt: '2026-05-07T10:00:00.000Z',
      reaction: 'ras'
    };

    const r1 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    const r2 = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: String(c.id) },
          formData
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );

    expect(r1.kind).toBe('redirect');
    expect(r2.kind).toBe('redirect');

    const count =
      testDb
        .select({ n: sql<number>`count(*)` })
        .from(foodEntries)
        .get()?.n ?? 0;
    expect(count).toBe(2);
  });
});

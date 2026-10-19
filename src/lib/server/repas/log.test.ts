import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';
import { seedChild, seedUser } from '../../../test/route';
import {
  entryRows,
  expectRefusal,
  form,
  ok,
  recently,
  seedFood,
  seedRepasChild
} from '../../../test/repas';

// The audit sink is a console line; record it to check a replay audits once.
mock.module('#lib/server/audit.js', () => ({ audit: mock() }));

import { audit } from '#lib/server/audit.js';
import { foods, preparedMeals } from '#lib/server/db/schema.js';
import { ALLERGENS } from '#lib/utils/allergens.js';
import { logRepas, readRepas } from './index';

const auditMock = audit as unknown as { mock: { calls: unknown[][] }; mockClear: () => void };

beforeEach(async () => {
  await resetTestDb();
  auditMock.mockClear();
});

async function threeAliments() {
  const seeded = await seedRepasChild();
  const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
  const riz = await seedFood({ name: 'Riz', category: 'feculents' });
  return { ...seeded, ids: [seeded.carotte.id, pomme.id, riz.id] };
}

describe('logRepas: two taps', () => {
  it('logs one aliment as a standalone repas and celebrates the first food', async () => {
    const { carotte, ctx, child, user } = await seedRepasChild();

    const logged = ok(
      logRepas(ctx, form({ foodId: carotte.id, givenAt: recently(), reaction: 'ras' }), null)
    );

    if (logged.replayed) throw new Error('a fresh key cannot replay');
    expect(logged.milestones).toEqual({
      firstFood: true,
      firstAllergen: null,
      allAllergens: false,
      categories: { before: 0, after: 1 }
    });
    expect(logged.redirect).toBe(
      `/child/${child.id}?logged=1&first=1&categories=1&prevCategories=0`
    );
    expect(readRepas(ctx, logged.entryIds[0])).toMatchObject({
      entry: { foodId: carotte.id, reaction: 'ras', texture: null, notes: null },
      meal: null
    });
    const [row] = entryRows(child.id);
    expect(row).toMatchObject({ mealId: null, loggedBy: user.id });
    // Set on insert alongside createdAt (last-write-wins concurrency policy).
    expect(row.updatedAt?.getTime()).toBe(row.createdAt.getTime());
    expect(auditMock.mock.calls).toEqual([
      [{ type: 'food_entry.created', userId: user.id, childId: child.id, count: 1 }]
    ]);
  });

  it('stores trimmed notes and a picked texture', async () => {
    const { carotte, ctx } = await seedRepasChild();
    const fields = { foodId: carotte.id, givenAt: recently(), reaction: 'inconfort' };
    const { entryIds } = ok(
      logRepas(ctx, form({ ...fields, texture: 'ecrasee', notes: '  a bien mangé ' }), null)
    ) as { entryIds: number[] };
    expect(readRepas(ctx, entryIds[0])?.entry).toMatchObject({
      reaction: 'inconfort',
      texture: 'ecrasee',
      notes: 'a bien mangé'
    });
  });
});

describe('logRepas: meals', () => {
  it('logs several aliments as one meal sharing a mealId', async () => {
    const { ctx, child, ids } = await threeAliments();
    ok(logRepas(ctx, form({ foodId: ids, givenAt: recently(), reaction: 'ras' }), null));

    const rows = entryRows(child.id);
    expect(rows.map((r) => r.foodId)).toEqual(ids);
    expect(new Set(rows.map((r) => r.mealId)).size).toBe(1);
    expect(rows[0].mealId).not.toBeNull();
    expect(readRepas(ctx, rows[0].id)?.meal?.members.map((m) => m.foodName)).toEqual([
      'Carotte',
      'Pomme',
      'Riz'
    ]);
  });

  it('logs a repeated aliment once, as a standalone entry', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    ok(
      logRepas(
        ctx,
        form({ foodId: [carotte.id, carotte.id], givenAt: recently(), reaction: 'ras' }),
        null
      )
    );
    expect(entryRows(child.id).map((r) => [r.foodId, r.mealId])).toEqual([[carotte.id, null]]);
  });

  it('refuses more than 20 aliments before looking any of them up', async () => {
    const { ctx } = await seedRepasChild();
    const ids = Array.from({ length: 21 }, (_, i) => i + 1);
    expectRefusal(
      logRepas(ctx, form({ foodId: ids, givenAt: recently(), reaction: 'ras' }), null),
      400,
      'errorsLogTooManyFoods'
    );
  });
});

describe('logRepas: field errors', () => {
  it('refuses a repas with no aliment', async () => {
    const { ctx } = await seedRepasChild();
    expectRefusal(
      logRepas(ctx, form({ givenAt: recently(), reaction: 'ras' }), null),
      400,
      'errorsLogNoFoodSelected'
    );
  });

  it('treats a whitespace-only custom name as no aliment', async () => {
    const { ctx } = await seedRepasChild();
    expectRefusal(
      logRepas(ctx, form({ 'customFood.name': '   ', givenAt: recently(), reaction: 'ras' }), null),
      400,
      'errorsLogNoFoodSelected'
    );
  });

  it('logs the picked aliments when the custom name is left blank', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    ok(
      logRepas(
        ctx,
        form({ foodId: carotte.id, 'customFood.name': ' ', givenAt: recently(), reaction: 'ras' }),
        null
      )
    );
    expect(entryRows(child.id)).toHaveLength(1);
  });

  it('refuses an aliment the child cannot see, or a malformed id', async () => {
    const { ctx, user, carotte } = await seedRepasChild();
    const other = await seedChild({ createdBy: user.id, birthDate: '2023-01-01' });
    const theirs = await seedFood({
      name: 'Leur plat',
      category: 'autre',
      customForChildId: other.id
    });
    for (const foodId of [String(theirs.id), 'abc', '0']) {
      expectRefusal(
        logRepas(
          ctx,
          form({ foodId: [carotte.id, foodId], givenAt: recently(), reaction: 'ras' }),
          null
        ),
        400,
        'errorsLogFoodNotFound'
      );
    }
  });

  it('refuses a missing, unparsable, future or pre-birth date and writes nothing', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    const cases: [Record<string, string>, Parameters<typeof expectRefusal>[2]][] = [
      [{}, 'errorsLogDateRequired'],
      [{ givenAt: '' }, 'errorsLogDateRequired'],
      [{ givenAt: 'not-a-date' }, 'errorsLogDateInvalid'],
      [{ givenAt: '2099-01-01T10:00' }, 'errorsLogDateFuture'],
      // seedChild's default birth date is 2024-01-01.
      [{ givenAt: '2023-06-01T10:00' }, 'errorsLogDateBeforeBirth']
    ];
    for (const [date, errorKey] of cases) {
      const fields = { foodId: carotte.id, reaction: 'ras', ...date };
      expectRefusal(logRepas(ctx, form(fields), null), 400, errorKey);
    }
    expect(entryRows(child.id)).toEqual([]);
  });

  it('refuses a missing or unknown reaction', async () => {
    const { ctx, carotte } = await seedRepasChild();
    for (const reaction of [undefined, 'pas-une-reaction']) {
      const fields = { foodId: carotte.id, givenAt: recently(), ...(reaction ? { reaction } : {}) };
      expectRefusal(logRepas(ctx, form(fields), null), 400, 'errorsAuthBadInput');
    }
  });

  it('reads an empty texture as no texture, and refuses an unknown one', async () => {
    const { ctx, carotte } = await seedRepasChild();
    const fields = { foodId: carotte.id, givenAt: recently(), reaction: 'ras' };
    const { entryIds } = ok(logRepas(ctx, form({ ...fields, texture: '' }), null)) as {
      entryIds: number[];
    };
    expect(readRepas(ctx, entryIds[0])?.entry.texture).toBeNull();
    expectRefusal(
      logRepas(ctx, form({ ...fields, texture: 'pas-une-texture' }), null),
      400,
      'errorsLogTextureInvalid'
    );
  });

  it('caps the stored notes at 2000 characters, after trimming', async () => {
    const { ctx, carotte } = await seedRepasChild();
    const fields = { foodId: carotte.id, givenAt: recently(), reaction: 'ras' };
    ok(logRepas(ctx, form({ ...fields, notes: ` ${'x'.repeat(2000)} ` }), null));
    expectRefusal(
      logRepas(ctx, form({ ...fields, notes: 'x'.repeat(2001) }), null),
      400,
      'errorsLogNoteTooLong'
    );
  });

  it('refuses a custom name longer than 80 characters', async () => {
    const { ctx } = await seedRepasChild();
    const fields = { 'customFood.name': 'x'.repeat(81), givenAt: recently(), reaction: 'ras' };
    expectRefusal(logRepas(ctx, form(fields), null), 400, 'errorsAuthBadInput');
  });
});

describe('logRepas: custom aliments', () => {
  function logCustom(ctx: Parameters<typeof logRepas>[0], name: string, category?: string) {
    const fields = { 'customFood.name': name, givenAt: recently(), reaction: 'ras' };
    return ok(
      logRepas(ctx, form(category ? { ...fields, 'customFood.category': category } : fields), null)
    ) as { entryIds: number[] };
  }

  function customFoodsOf(childId: number) {
    return testDb.select().from(foods).where(eq(foods.customForChildId, childId)).all();
  }

  it('creates a custom aliment for this child, in a known category or else "autre"', async () => {
    const { ctx, child } = await seedRepasChild();
    logCustom(ctx, 'Crêpe', 'feculents');
    logCustom(ctx, 'Couscous maison', 'unknown-category');
    expect(customFoodsOf(child.id).map((f) => [f.name, f.category, f.isCustom])).toEqual([
      ['Crêpe', 'feculents', true],
      ['Couscous maison', 'autre', true]
    ]);
  });

  it('reuses the child’s custom aliment on a retried submit with a matching name', async () => {
    const { ctx, child } = await seedRepasChild();
    logCustom(ctx, 'Purée maison');
    logCustom(ctx, '  purée MAISON ');
    const rows = entryRows(child.id);
    expect(customFoodsOf(child.id)).toHaveLength(1);
    expect(rows[0].foodId).toBe(rows[1].foodId);
  });

  it('does not reuse another child’s custom aliment or a catalog aliment of the same name', async () => {
    const { ctx, child, user } = await seedRepasChild();
    const sibling = await seedChild({ createdBy: user.id, birthDate: '2023-01-01' });
    await seedFood({ name: 'Purée maison', category: 'autre', customForChildId: sibling.id });
    logCustom(ctx, 'Purée maison');
    logCustom(ctx, 'Carotte');
    expect(customFoodsOf(child.id).map((f) => f.name)).toEqual(['Purée maison', 'Carotte']);
  });

  it('logs a custom aliment alongside picked ones as one meal', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    const fields = {
      foodId: carotte.id,
      'customFood.name': 'Compote',
      givenAt: recently(),
      reaction: 'ras'
    };
    ok(logRepas(ctx, form(fields), null));
    const rows = entryRows(child.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].mealId).toBe(rows[1].mealId);
  });

  it('rolls the custom aliment back when the repas is refused or its insert fails', async () => {
    const { ctx, child } = await seedRepasChild();
    const fields = { 'customFood.name': 'Purée orpheline', reaction: 'ras' };
    expectRefusal(
      logRepas(ctx, form({ ...fields, givenAt: '2099-01-01T10:00' }), null),
      400,
      'errorsLogDateFuture'
    );

    // SQLite can't add a CHECK through ALTER TABLE, so a trigger stands in
    // for an entry insert that fails after the custom aliment was inserted.
    testDb.run(
      sql`CREATE TRIGGER tmp_abort_entry BEFORE INSERT ON food_entries
          WHEN NEW.notes = '__simulated_fail__'
          BEGIN SELECT RAISE(ABORT, 'simulated entry-insert failure'); END`
    );
    try {
      expect(() =>
        logRepas(ctx, form({ ...fields, givenAt: recently(), notes: '__simulated_fail__' }), null)
      ).toThrow();
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS tmp_abort_entry`);
    }

    expect(customFoodsOf(child.id)).toEqual([]);
    expect(entryRows(child.id)).toEqual([]);
  });
});

describe('logRepas: plats préparés', () => {
  it('saves a named plat préparé with the repas’s aliments, once', async () => {
    const { ctx, child, ids } = await threeAliments();
    const fields = {
      foodId: ids.slice(0, 2),
      'preparedMeal.brand': 'Babybio',
      'preparedMeal.name': 'Légumes et riz',
      reaction: 'ras'
    };
    ok(logRepas(ctx, form({ ...fields, givenAt: '2024-06-01T10:00:00Z' }), null));
    ok(logRepas(ctx, form({ ...fields, foodId: ids, givenAt: '2024-05-01T10:00:00Z' }), null));

    expect(testDb.select().from(preparedMeals).all()).toMatchObject([
      {
        childId: child.id,
        brand: 'Babybio',
        name: 'Légumes et riz',
        ingredientFoodIds: ids,
        // A backdated repas doesn't move lastUsedAt back.
        lastUsedAt: new Date('2024-06-01T10:00:00Z')
      }
    ]);
  });

  it('touches a picked plat préparé of this child', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    const [saved] = await testDb
      .insert(preparedMeals)
      .values({
        childId: child.id,
        brand: 'Yooji',
        name: 'Purée verte',
        ingredientFoodIds: [carotte.id],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    const fields = { foodId: carotte.id, preparedMealId: saved.id, reaction: 'ras' };
    ok(logRepas(ctx, form({ ...fields, givenAt: '2024-06-01T10:00:00Z' }), null));
    expect(testDb.select().from(preparedMeals).get()?.lastUsedAt).toEqual(
      new Date('2024-06-01T10:00:00Z')
    );
  });

  it('refuses another child’s plat préparé, or half a name, and logs nothing', async () => {
    const { ctx, child, user, carotte } = await seedRepasChild();
    const other = await seedChild({ createdBy: user.id, birthDate: '2023-01-01' });
    const [foreign] = await testDb
      .insert(preparedMeals)
      .values({
        childId: other.id,
        brand: 'Yooji',
        name: 'Purée verte',
        ingredientFoodIds: [carotte.id],
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    const fields = { foodId: carotte.id, givenAt: recently(), reaction: 'ras' };
    for (const extra of [
      { preparedMealId: foreign.id },
      { preparedMealId: 'abc' },
      { 'preparedMeal.brand': 'Yooji' },
      { 'preparedMeal.name': 'Purée verte' },
      { 'preparedMeal.brand': 'x'.repeat(61), 'preparedMeal.name': 'Purée verte' }
    ]) {
      expectRefusal(logRepas(ctx, form({ ...fields, ...extra }), null), 400, 'errorsAuthBadInput');
    }
    expect(entryRows(child.id)).toEqual([]);
  });
});

describe('logRepas: milestones', () => {
  async function logOne(
    ctx: Parameters<typeof logRepas>[0],
    foodId: number | number[],
    reaction = 'ras'
  ) {
    const logged = ok(logRepas(ctx, form({ foodId, givenAt: recently(), reaction }), null));
    if (logged.replayed) throw new Error('a fresh key cannot replay');
    return logged.milestones;
  }

  async function allergenAliment(allergenType: string, category = 'allergenes') {
    return seedFood({ name: `aliment-${allergenType}-${category}`, category, allergenType });
  }

  it('celebrates a priority allergen tolerated for the first time, only once', async () => {
    const { ctx } = await seedRepasChild();
    const arachide = await allergenAliment('arachide');
    expect(await logOne(ctx, arachide.id)).toEqual({
      firstFood: true,
      firstAllergen: 'arachide',
      allAllergens: false,
      // 'allergenes' is a category bucket; only 'autre' is excluded.
      categories: { before: 0, after: 1 }
    });
    expect((await logOne(ctx, arachide.id)).firstAllergen).toBeNull();
  });

  it('does not celebrate an allergen logged with a reaction, nor a soja exposure', async () => {
    const { ctx } = await seedRepasChild();
    expect(
      (await logOne(ctx, (await allergenAliment('oeuf')).id, 'inconfort')).firstAllergen
    ).toBeNull();
    // soja is tracked but has no preventive introduction calendar.
    expect((await logOne(ctx, (await allergenAliment('soja')).id)).firstAllergen).toBeNull();
  });

  it('does not count an allergenic fat as an allergen exposure', async () => {
    const { ctx } = await seedRepasChild();
    const beurre = await allergenAliment('lait', 'matieres_grasses');
    expect((await logOne(ctx, beurre.id)).firstAllergen).toBeNull();
  });

  it('celebrates all allergens when one repas introduces the final ones', async () => {
    const { ctx } = await seedRepasChild();
    const aliments = await Promise.all(ALLERGENS.map((a) => allergenAliment(a.id)));
    await logOne(
      ctx,
      aliments.slice(0, 10).map((a) => a.id)
    );
    expect(await logOne(ctx, [aliments[11].id, aliments[10].id])).toMatchObject({
      firstFood: false,
      allAllergens: true
    });
    expect((await logOne(ctx, aliments[0].id)).allAllergens).toBe(false);
  });

  it('reports category coverage before and after, excluding "autre"', async () => {
    const { ctx, ids } = await threeAliments();
    await logOne(ctx, ids[0]);
    expect((await logOne(ctx, ids.slice(1))).categories).toEqual({ before: 1, after: 3 });
    const autre = await seedFood({ name: 'Plat', category: 'autre' });
    expect((await logOne(ctx, autre.id)).categories).toEqual({ before: 3, after: 3 });
  });
});

describe('logRepas: idempotency key', () => {
  const fields = (foodId: number | number[]) => ({
    foodId,
    givenAt: '2026-05-07T10:00:00.000Z',
    reaction: 'ras'
  });

  it('replays a second submit under the same key without writing or auditing again', async () => {
    const { ctx, child, ids } = await threeAliments();
    const first = ok(logRepas(ctx, form(fields(ids)), 'key-replay-1'));
    const again = ok(logRepas(ctx, form(fields(ids)), 'key-replay-1'));

    expect(first.replayed).toBe(false);
    expect(again).toEqual({ ok: true, replayed: true, redirect: first.redirect });
    const rows = entryRows(child.id);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.mealId)).size).toBe(1);
    expect(auditMock.mock.calls).toHaveLength(1);
  });

  it('reads the key from the form field when there is no header', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    const withKey = { ...fields(carotte.id), idempotencyKey: 'field-key-1' };
    ok(logRepas(ctx, form(withKey), null));
    expect(ok(logRepas(ctx, form(withKey), null)).replayed).toBe(true);
    // The header wins over the field.
    expect(ok(logRepas(ctx, form(withKey), 'header-key-1')).replayed).toBe(false);
    expect(entryRows(child.id)).toHaveLength(2);
  });

  it('logs twice without a key, or under two keys', async () => {
    const { ctx, child, carotte } = await seedRepasChild();
    ok(logRepas(ctx, form(fields(carotte.id)), null));
    ok(logRepas(ctx, form(fields(carotte.id)), null));
    ok(logRepas(ctx, form(fields(carotte.id)), 'key-a'));
    ok(logRepas(ctx, form(fields(carotte.id)), 'key-b'));
    expect(entryRows(child.id)).toHaveLength(4);
  });

  it('refuses a malformed key', async () => {
    const { ctx, carotte } = await seedRepasChild();
    for (const key of ['x'.repeat(101), 'pas une clé']) {
      expectRefusal(
        logRepas(ctx, form(fields(carotte.id)), key),
        400,
        'errorsLogIdempotencyKeyInvalid'
      );
    }
  });

  it('refuses a key already used for another child, or by another parent', async () => {
    const { ctx, child, user, carotte } = await seedRepasChild();
    const sibling = await seedChild({ createdBy: user.id, birthDate: '2024-02-01' });
    const coparent = await seedUser({ email: 'coparent@example.com' });
    ok(logRepas(ctx, form(fields(carotte.id)), 'k1'));

    for (const other of [
      { childId: sibling.id, user: ctx.user },
      { childId: child.id, user: { id: coparent.id } }
    ]) {
      expectRefusal(
        logRepas(other, form(fields(carotte.id)), 'k1'),
        409,
        'errorsLogIdempotencyConflict'
      );
    }
    // The co-parent was not silently served the first parent's replay.
    expect(entryRows(child.id).map((r) => r.loggedBy)).toEqual([user.id]);
  });
});

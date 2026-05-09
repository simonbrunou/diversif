import { describe, it, expect, beforeEach } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';
import { FOODS_SEED, seedFoods, applySeedCorrections } from './seed';
import { foods } from './schema';

beforeEach(async () => {
  await resetTestDb();
});

describe('FOODS_SEED catalog', () => {
  it('every entry has the required shape', () => {
    for (const f of FOODS_SEED) {
      expect(typeof f.name).toBe('string');
      expect(f.name.length).toBeGreaterThan(0);
      expect(typeof f.category).toBe('string');
      expect(typeof f.age).toBe('number');
      if (f.allergen != null) expect(typeof f.allergen).toBe('string');
    }
  });

  it('food names are unique', () => {
    const names = FOODS_SEED.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('seedFoods', () => {
  it('inserts every seed row when foods table is empty', async () => {
    await seedFoods(testDb);
    const rows = await testDb.select().from(foods);
    expect(rows.length).toBe(FOODS_SEED.length);
    const major = rows.filter((r) => r.isMajorAllergen);
    expect(major.length).toBeGreaterThan(0);
    for (const m of major) expect(m.allergenType).not.toBeNull();
  });

  it('does not duplicate rows when foods already exist', async () => {
    await seedFoods(testDb);
    const before = (await testDb.select().from(foods)).length;
    await seedFoods(testDb);
    const after = (await testDb.select().from(foods)).length;
    expect(after).toBe(before);
  });

  it('runs corrections on a populated DB carrying stale Tofu age', async () => {
    await seedFoods(testDb);
    // Simulate a deploy that crossed the SQLite -> Postgres cutover with the
    // pre-2026-05-08 Tofu age still in the table.
    await testDb.update(foods).set({ suggestedAgeMonths: 6 }).where(eq(foods.name, 'Tofu'));

    await seedFoods(testDb);

    const [tofu] = await testDb.select().from(foods).where(eq(foods.name, 'Tofu'));
    expect(tofu.suggestedAgeMonths).toBe(36);
  });
});

describe('applySeedCorrections', () => {
  it('raises stale Tofu age from 6 to 36', async () => {
    await seedFoods(testDb);
    await testDb.update(foods).set({ suggestedAgeMonths: 6 }).where(eq(foods.name, 'Tofu'));

    await applySeedCorrections(testDb);

    const [tofu] = await testDb.select().from(foods).where(eq(foods.name, 'Tofu'));
    expect(tofu.suggestedAgeMonths).toBe(36);
  });

  it('is a no-op on a freshly seeded DB (Tofu already at 36)', async () => {
    await seedFoods(testDb);
    const [before] = await testDb.select().from(foods).where(eq(foods.name, 'Tofu'));

    await applySeedCorrections(testDb);

    const [after] = await testDb.select().from(foods).where(eq(foods.name, 'Tofu'));
    expect(after.suggestedAgeMonths).toBe(before.suggestedAgeMonths);
  });

  it('leaves an operator-customised Tofu row alone', async () => {
    await seedFoods(testDb);
    // Operator copy: a custom child-scoped Tofu pinned at 6 months on purpose.
    await testDb.insert(foods).values({
      name: 'Tofu',
      category: 'legumineuses',
      isMajorAllergen: true,
      allergenType: 'soja',
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: true,
      customForChildId: null
    });

    await applySeedCorrections(testDb);

    const customRows = await testDb
      .select()
      .from(foods)
      .where(and(eq(foods.name, 'Tofu'), eq(foods.isCustom, true)));
    expect(customRows).toHaveLength(1);
    expect(customRows[0].suggestedAgeMonths).toBe(6);
  });
});

import { beforeEach, describe, expect, it } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { seedUser, seedChild, seedMembership } from '../../../test/route';
import { foodEntries, foods } from './schema';
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  await resetTestDb();
});

async function seedFood(name: string) {
  const [row] = await testDb
    .insert(foods)
    .values({
      name,
      category: 'fruits',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning();
  return row;
}

describe('food_entries.texture column', () => {
  it('column exists in the food_entries table', () => {
    // Verifies the migration added the column, via SQLite's table introspection
    // pragma. Nullability is exercised by the "accepts null texture" test below.
    const rows = testDb.all(
      sql`SELECT name FROM pragma_table_info('food_entries') WHERE name = 'texture'`
    ) as Array<{ name: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('texture');
  });

  it('accepts null texture', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const [row] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(),
        reaction: 'ras',
        texture: null,
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    expect(row.texture).toBeNull();
  });

  it('accepts a valid texture value', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const [row] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'lisse',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    expect(row.texture).toBe('lisse');
  });

  it('rejects an invalid texture value via CHECK constraint', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');

    // Must reject with the invalid texture value. Wrap in an async IIFE so
    // bun:test's .rejects sees a real Promise — Drizzle's PgInsertBase is
    // thenable but bun checks isPromise() before awaiting.
    await expect(
      (async () =>
        await testDb.insert(foodEntries).values({
          childId: c.id,
          foodId: food.id,
          givenAt: new Date(),
          reaction: 'ras',
          texture: 'not-a-texture' as never,
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        }))()
    ).rejects.toThrow();

    // Control: the same FK values with a valid texture must succeed.
    // If the failure above were caused by a FK/NOT-NULL problem instead of the
    // CHECK constraint, this control insert would also fail, making the test
    // self-contradictory and immediately obvious.
    const [control] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(),
        reaction: 'ras',
        texture: 'lisse',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    expect(control.texture).toBe('lisse');
  });
});

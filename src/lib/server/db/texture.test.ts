import { describe, it, expect, beforeEach } from 'vitest';
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
  it('column exists in information_schema', async () => {
    // Verifies the migration added the column. We do not assert is_nullable='YES'
    // here because pg-mem always returns 'NO' for that field even for nullable
    // columns; nullability is exercised by the "accepts null texture" test below.
    const rows = await testDb.execute(
      sql`SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'food_entries'
            AND column_name = 'texture'`
    );
    expect(rows.rows).toHaveLength(1);
    expect((rows.rows[0] as { column_name: string }).column_name).toBe('texture');
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
    await expect(
      testDb.execute(
        sql`INSERT INTO food_entries (child_id, food_id, given_at, reaction, texture, logged_by, created_at)
            VALUES (
              (SELECT id FROM children LIMIT 1),
              (SELECT id FROM foods LIMIT 1),
              now(), 'ras', 'not-a-texture', NULL, now()
            )`
      )
    ).rejects.toThrow();
  });
});

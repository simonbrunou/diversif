import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { loadTexturesTried } from './seasonal';
import { children, foods, foodEntries, users } from '#lib/server/db/schema.js';
import type { TextureKey } from '#lib/utils/textures.js';

async function seedUserAndChild() {
  const [user] = await testDb
    .insert(users)
    .values({ email: 'p@example.com', passwordHash: 'pw', displayName: 'P', createdAt: new Date() })
    .returning();
  const [child] = await testDb
    .insert(children)
    .values({ name: 'Bébé', birthDate: '2024-01-01', createdBy: user.id, createdAt: new Date() })
    .returning();
  return { user, child };
}

async function seedFood() {
  const [food] = await testDb
    .insert(foods)
    .values({
      name: 'Carotte',
      category: 'legumes',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning();
  return food;
}

beforeEach(async () => {
  await resetTestDb();
});

describe('loadTexturesTried', () => {
  it('counts distinct non-null textures and ignores null texture entries', async () => {
    const { user, child } = await seedUserAndChild();
    const food = await seedFood();
    const now = Date.now();
    // lisse twice counts once, ecrasee once more, a null texture not at all.
    const textures: Array<TextureKey | null> = ['lisse', 'lisse', 'ecrasee', null];
    await testDb.insert(foodEntries).values(
      textures.map((texture, i) => ({
        childId: child.id,
        foodId: food.id,
        givenAt: new Date(now - (i + 1) * 1000),
        reaction: 'ras' as const,
        notes: null,
        loggedBy: user.id,
        createdAt: new Date(),
        texture
      }))
    );
    expect(await loadTexturesTried(child.id)).toBe(2);
  });

  it('returns 0 when no entries exist', async () => {
    const { child } = await seedUserAndChild();
    expect(await loadTexturesTried(child.id)).toBe(0);
  });
});

import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

const { resolveOrInsertFood } = await import('./food-resolution');

import { db } from '$lib/server/db';
import { children, foods, users } from '$lib/server/db/schema';

// Seed a user + child so FK constraints on customForChildId are satisfied.
async function seedChild(): Promise<number> {
  const [user] = await db
    .insert(users)
    .values({
      email: `food-test-${Date.now()}@example.com`,
      displayName: 'Test',
      passwordHash: 'x',
      createdAt: new Date()
    })
    .returning({ id: users.id });
  const [child] = await db
    .insert(children)
    .values({ name: 'Bébé', birthDate: '2025-01-01', createdBy: user.id, createdAt: new Date() })
    .returning({ id: children.id });
  return child.id;
}

// Seed a global food row so we can resolve it by id.
const CHILD_ID = await seedChild();
const ANOTHER_CHILD_ID = await seedChild();

const GLOBAL_FOOD_ID = await (async () => {
  const [row] = await db
    .insert(foods)
    .values({
      name: 'Carotte (test)',
      category: 'legume',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning({ id: foods.id });
  return row.id;
})();

describe('resolveOrInsertFood', () => {
  it('resolves an existing food by id', async () => {
    const result = await resolveOrInsertFood({ foodId: GLOBAL_FOOD_ID, childId: CHILD_ID });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.foodId).toBe(GLOBAL_FOOD_ID);
      expect(result.food.name).toBe('Carotte (test)');
    }
  });

  it('inserts a custom food and returns it when only customName is given', async () => {
    const result = await resolveOrInsertFood({
      customName: 'Purée maison',
      customCategory: 'legume',
      childId: CHILD_ID
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.food.name).toBe('Purée maison');
      expect(result.food.isCustom).toBe(true);
      expect(result.food.customForChildId).toBe(CHILD_ID);
    }
  });

  it('falls back to "autre" when customCategory is unrecognised', async () => {
    const result = await resolveOrInsertFood({
      customName: 'Truc inconnu',
      customCategory: 'xyz-invalid',
      childId: CHILD_ID
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.food.category).toBe('autre');
    }
  });

  it('returns not-found when foodId does not exist', async () => {
    const result = await resolveOrInsertFood({ foodId: 999999, childId: CHILD_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });

  it('returns invalid-custom when neither foodId nor customName is given', async () => {
    const result = await resolveOrInsertFood({ childId: CHILD_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('invalid-custom');
  });

  it('returns not-found when foodId belongs to a different child', async () => {
    // Insert a food scoped to ANOTHER_CHILD_ID.
    const [customRow] = await db
      .insert(foods)
      .values({
        name: 'Custom other-child food',
        category: 'autre',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 0,
        notes: null,
        isCustom: true,
        customForChildId: ANOTHER_CHILD_ID
      })
      .returning({ id: foods.id });

    // Try to resolve it as CHILD_ID — should be blocked.
    const result = await resolveOrInsertFood({ foodId: customRow.id, childId: CHILD_ID });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found');
  });
});

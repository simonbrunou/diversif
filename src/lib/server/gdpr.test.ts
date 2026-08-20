import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';
import { randomUUID } from 'crypto';

mock.module('$lib/server/db', () => ({ db: testDb }));

const { exportUserData } = await import('./gdpr');

import { db } from '$lib/server/db';
import { children, foodEntries, foods, memberships, users } from '$lib/server/db/schema';

async function setupTestData() {
  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: `gdpr-test-${Date.now()}@example.com`,
      displayName: 'Test User',
      passwordHash: 'hash',
      createdAt: new Date()
    })
    .returning({ id: users.id });

  // Create child
  const [child] = await db
    .insert(children)
    .values({
      name: 'Test Child',
      birthDate: '2024-01-01',
      createdBy: user.id,
      createdAt: new Date()
    })
    .returning({ id: children.id });

  // Create membership
  await db.insert(memberships).values({
    userId: user.id,
    childId: child.id,
    role: 'owner',
    createdAt: new Date()
  });

  // Create foods
  const [carrot] = await db
    .insert(foods)
    .values({
      name: 'Carotte',
      category: 'legume',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 4,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning({ id: foods.id });

  const [chicken] = await db
    .insert(foods)
    .values({
      name: 'Poulet',
      category: 'viande',
      isMajorAllergen: false,
      allergenType: null,
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning({ id: foods.id });

  const mealId = randomUUID();
  const now = new Date();

  // Create multi-ingredient meal (shared mealId)
  await db.insert(foodEntries).values([
    {
      childId: child.id,
      foodId: carrot.id,
      givenAt: now,
      reaction: 'ras',
      texture: null,
      notes: null,
      loggedBy: user.id,
      createdAt: now,
      mealId
    },
    {
      childId: child.id,
      foodId: chicken.id,
      givenAt: now,
      reaction: 'ras',
      texture: null,
      notes: null,
      loggedBy: user.id,
      createdAt: now,
      mealId
    }
  ]);

  // Create standalone entry (no mealId)
  await db.insert(foodEntries).values({
    childId: child.id,
    foodId: carrot.id,
    givenAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // next day
    reaction: 'ras',
    texture: null,
    notes: null,
    loggedBy: user.id,
    createdAt: now,
    mealId: null
  });

  return { userId: user.id, childId: child.id, mealId };
}

describe('exportUserData', () => {
  it('includes mealId in exported food entries for multi-ingredient meals', async () => {
    const { userId, mealId } = await setupTestData();

    const exported = await exportUserData(userId);

    expect(exported.children).toHaveLength(1);
    expect(exported.children[0].foodEntries).toHaveLength(3);

    // The two entries in the multi-ingredient meal should have the same mealId
    const mealEntries = exported.children[0].foodEntries.filter((e) => e.mealId === mealId);
    expect(mealEntries).toHaveLength(2);
    expect(mealEntries[0].foodName).toBe('Carotte');
    expect(mealEntries[1].foodName).toBe('Poulet');

    // The standalone entry should have mealId = null
    const standaloneEntries = exported.children[0].foodEntries.filter((e) => e.mealId === null);
    expect(standaloneEntries).toHaveLength(1);
    expect(standaloneEntries[0].foodName).toBe('Carotte');
  });
});

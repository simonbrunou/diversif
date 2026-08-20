// Task 12: loadCoparentActivity must project mealId and keep a meal's rows
// adjacent (sorted givenAt desc, id asc) so groupByMeal folds a co-parent's
// multi-ingredient meal into ONE activity entry instead of one near-identical
// row per ingredient. Pre-existing loadCoparentActivity coverage (empty /
// excludes-self / day-window / limit) stays in the legacy
// `../queries.test.ts` file — this file only adds the meal-grouping contract
// introduced by this task.
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { loadCoparentActivity } from './timeline';
import { children, foods, foodEntries, users } from '$lib/server/db/schema';
import { groupByMeal } from '$lib/utils/meals';

beforeEach(async () => {
  await resetTestDb();
});

async function seedUserAndChild() {
  const user = (
    await testDb
      .insert(users)
      .values({
        email: 'p@example.com',
        passwordHash: 'pw',
        displayName: 'P',
        createdAt: new Date()
      })
      .returning()
  )[0];
  const child = (
    await testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy: user.id,
        createdAt: new Date()
      })
      .returning()
  )[0];
  return { user, child };
}

async function seedPartner(email = 'partner@example.com', name = 'Partenaire') {
  return (
    await testDb
      .insert(users)
      .values({ email, passwordHash: 'pw', displayName: name, createdAt: new Date() })
      .returning()
  )[0];
}

async function seedFood(name: string, category: string) {
  return (
    await testDb
      .insert(foods)
      .values({
        name,
        category,
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 6,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
}

describe('loadCoparentActivity — meal grouping (Task 12)', () => {
  it("carries mealId and keeps a co-parent's 3-ingredient meal adjacent so groupByMeal folds it into ONE group of 3", async () => {
    const { user, child } = await seedUserAndChild();
    const partner = await seedPartner();
    const sharedMealId = crypto.randomUUID();
    // loadCoparentActivity defaults to a 7-day window, so entries must be
    // recent relative to "now" (unlike the mealId/adjacency-only fixtures
    // elsewhere that use a fixed calendar date).
    const mealGivenAt = new Date(Date.now() - 60_000);

    for (const name of ['Carotte', 'Poire', 'Poulet']) {
      const food = await seedFood(name, 'legumes');
      await testDb.insert(foodEntries).values({
        childId: child.id,
        foodId: food.id,
        givenAt: mealGivenAt,
        reaction: 'ras',
        notes: null,
        loggedBy: partner.id,
        createdAt: new Date(),
        mealId: sharedMealId
      });
    }

    // An older, unrelated singleton from the same co-parent — present so the
    // adjacency assertion below is non-trivial: if the loader dropped its
    // ordering (or the `mealId` projection), this row could sort in between
    // the meal's 3 rows and split one group into two or three.
    const singletonFood = await seedFood('Pomme', 'fruits');
    await testDb.insert(foodEntries).values({
      childId: child.id,
      foodId: singletonFood.id,
      givenAt: new Date(mealGivenAt.getTime() - 60_000),
      reaction: 'ras',
      notes: null,
      loggedBy: partner.id,
      createdAt: new Date(),
      mealId: null
    });

    const out = await loadCoparentActivity(child.id, user.id);

    // The query carries mealId end-to-end.
    expect(out).toHaveLength(4);
    expect(out.filter((e) => e.mealId === sharedMealId)).toHaveLength(3);

    const groups = groupByMeal(out);

    // Adjacency proof: exactly 2 groups (the meal + the singleton), not 3 or
    // 4 — only true if the ordering kept the 3 meal rows contiguous.
    expect(groups).toHaveLength(2);
    expect(groups[0].mealId).toBe(sharedMealId);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].members.every((e) => e.mealId === sharedMealId)).toBe(true);
    expect(groups[1].mealId).toBeNull();
    expect(groups[1].members).toHaveLength(1);
  });
});

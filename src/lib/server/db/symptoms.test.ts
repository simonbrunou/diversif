import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';
import { seedUser, seedChild, seedMembership } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods, symptoms } from './schema';
import {
  deleteSymptomById,
  listSymptomsByEntry,
  insertSymptom,
  countNthExposition
} from './symptoms';

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

async function seedFoodEntry(opts: {
  childId: number;
  foodId: number;
  reaction: 'ras' | 'inconfort' | 'reaction';
  givenAt?: Date;
  loggedBy: number;
}) {
  const [row] = await testDb
    .insert(foodEntries)
    .values({
      childId: opts.childId,
      foodId: opts.foodId,
      givenAt: opts.givenAt ?? new Date(),
      reaction: opts.reaction,
      notes: null,
      loggedBy: opts.loggedBy,
      createdAt: new Date()
    })
    .returning();
  return row;
}

describe('symptoms queries', () => {
  it('listSymptomsByEntry returns rows in ascending observed_at', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'reaction',
      loggedBy: u.id
    });
    await testDb.insert(symptoms).values([
      {
        foodEntryId: entry.id,
        childId: c.id,
        observedAt: new Date('2026-05-01T12:10:00Z'),
        label: 'vomissement',
        note: null,
        createdBy: u.id
      },
      {
        foodEntryId: entry.id,
        childId: c.id,
        observedAt: new Date('2026-05-01T11:42:00Z'),
        label: 'rougeur',
        note: 'joue gauche',
        createdBy: u.id
      }
    ]);
    const list = await listSymptomsByEntry(entry.id);
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('rougeur');
    expect(list[1].label).toBe('vomissement');
  });

  it('insertSymptom persists a row', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'reaction',
      loggedBy: u.id
    });
    await insertSymptom({
      foodEntryId: entry.id,
      childId: c.id,
      observedAt: new Date('2026-05-01T11:42:00Z'),
      label: 'rougeur',
      note: 'joue gauche',
      createdBy: u.id,
      currentReaction: 'reaction'
    });
    const list = await listSymptomsByEntry(entry.id);
    expect(list).toHaveLength(1);
    expect(list[0].note).toBe('joue gauche');
  });

  it('insertSymptom persists null note', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'reaction',
      loggedBy: u.id
    });
    await insertSymptom({
      foodEntryId: entry.id,
      childId: c.id,
      observedAt: new Date('2026-05-01T11:42:00Z'),
      label: 'rougeur',
      note: null,
      createdBy: u.id,
      currentReaction: 'reaction'
    });
    const list = await listSymptomsByEntry(entry.id);
    expect(list[0].note).toBeNull();
  });

  it('countNthExposition counts entries up to and including the given entry', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const e1 = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date('2026-04-01'),
      reaction: 'ras',
      loggedBy: u.id
    });
    const e2 = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date('2026-04-15'),
      reaction: 'ras',
      loggedBy: u.id
    });
    const e3 = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date('2026-05-01'),
      reaction: 'reaction',
      loggedBy: u.id
    });
    expect(await countNthExposition(e1.id)).toBe(1);
    expect(await countNthExposition(e2.id)).toBe(2);
    expect(await countNthExposition(e3.id)).toBe(3);
  });

  it('countNthExposition returns 0 for unknown entry id', async () => {
    expect(await countNthExposition(99999)).toBe(0);
  });

  it('deleteSymptomById removes a row scoped to entry + child', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'reaction',
      loggedBy: u.id
    });
    const [row] = await testDb
      .insert(symptoms)
      .values({
        foodEntryId: entry.id,
        childId: c.id,
        observedAt: new Date(),
        label: 'rougeur',
        note: null,
        createdBy: u.id
      })
      .returning();
    const ok = await deleteSymptomById({
      symptomId: row.id,
      foodEntryId: entry.id,
      childId: c.id
    });
    expect(ok).toBe(true);
    expect(await testDb.select().from(symptoms)).toHaveLength(0);
  });

  it('deleteSymptomById refuses cross-entry deletion', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entryA = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date('2026-05-01'),
      reaction: 'reaction',
      loggedBy: u.id
    });
    const entryB = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date('2026-05-02'),
      reaction: 'reaction',
      loggedBy: u.id
    });
    const [row] = await testDb
      .insert(symptoms)
      .values({
        foodEntryId: entryA.id,
        childId: c.id,
        observedAt: new Date(),
        label: 'rougeur',
        note: null,
        createdBy: u.id
      })
      .returning();
    const ok = await deleteSymptomById({
      symptomId: row.id,
      foodEntryId: entryB.id,
      childId: c.id
    });
    expect(ok).toBe(false);
    expect(await testDb.select().from(symptoms)).toHaveLength(1);
  });

  it('the DB rejects a symptom label outside the SymptomLabel union', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Banane');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'ras',
      loggedBy: u.id
    });
    await expect(
      testDb.insert(symptoms).values({
        foodEntryId: entry.id,
        childId: c.id,
        observedAt: new Date(),
        // @ts-expect-error — runtime-only check that the DB rejects unknown labels
        label: 'not-a-known-label',
        note: null,
        createdBy: u.id
      })
    ).rejects.toThrow();
  });

  it('insertSymptom does not promote when entry has already been promoted concurrently', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const food = await seedFood('Poire');
    const entry = await seedFoodEntry({
      childId: c.id,
      foodId: food.id,
      reaction: 'reaction',
      loggedBy: u.id
    });
    const result = await insertSymptom({
      foodEntryId: entry.id,
      childId: c.id,
      observedAt: new Date('2026-05-01T11:42:00Z'),
      label: 'urticaire',
      note: null,
      createdBy: u.id,
      currentReaction: 'ras'
    });
    expect(result.promotedTo).toBeNull();
    const [row] = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(row.reaction).toBe('reaction');
  });
});

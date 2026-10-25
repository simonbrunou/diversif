import { asc, eq } from 'drizzle-orm';
import { expect } from 'bun:test';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import { insertSymptom } from '#lib/server/db/symptoms.js';
import type { RepasContext, RepasRefusal } from '#lib/server/repas/index.js';
import { testDb } from './db';
import { seedChild, seedUser } from './route';

// Shared fixtures for the repas write module tests (src/lib/server/repas).

type FoodSeed = {
  name: string;
  category?: string;
  allergenType?: string | null;
  customForChildId?: number | null;
};

export async function seedFood({
  name,
  category = 'legumes',
  allergenType = null,
  customForChildId = null
}: FoodSeed) {
  return (
    await testDb
      .insert(foods)
      .values({
        name,
        category,
        isMajorAllergen: allergenType !== null,
        allergenType,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: customForChildId !== null,
        customForChildId
      })
      .returning()
  )[0];
}

/** A parent with a child born 2024-01-01 and one catalog aliment, as requireChildContext would hand it over. */
export async function seedRepasChild(opts: { email?: string } = {}) {
  const user = await seedUser({ email: opts.email });
  const child = await seedChild({ createdBy: user.id });
  const carotte = await seedFood({ name: 'Carotte', category: 'legumes' });
  const ctx: RepasContext = { childId: child.id, user: { id: user.id } };
  return { user, child, carotte, ctx };
}

/** FormData the way the repas forms post it: an array becomes a repeated key. */
export function form(fields: Record<string, string | number | (string | number)[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) fd.append(key, String(item));
  }
  return fd;
}

export function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`expected the write to succeed, got ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

export function expectRefusal(
  result: { ok: boolean },
  status: RepasRefusal['status'],
  errorKey: RepasRefusal['errorKey']
): void {
  expect(result).toEqual({ ok: false, status, errorKey });
}

/** An ISO givenAt a few minutes ago: inside the meal-date bounds for any seeded child. */
export function recently(): string {
  return new Date(Date.now() - 5 * 60 * 1000).toISOString();
}

/** The stored rows, for what the module interface doesn't expose (mealId, updatedAt, loggedBy). */
export function entryRows(childId: number) {
  return testDb
    .select()
    .from(foodEntries)
    .where(eq(foodEntries.childId, childId))
    .orderBy(asc(foodEntries.id))
    .all();
}

export function entryRow(id: number) {
  return testDb.select().from(foodEntries).where(eq(foodEntries.id, id)).get();
}

/**
 * A symptom on a RAS entry, added through the real writer by the seeded
 * parent, the way a co-parent's would land between the edit form's load and
 * its submit: insertSymptom promotes the entry to inconfort, or to reaction
 * for a severe symptom. Returns what it promoted to.
 */
export async function addSymptom(
  { child, user }: { child: { id: number }; user: { id: number } },
  entryId: number,
  label: 'rougeur' | 'gonflement' = 'rougeur'
) {
  const { promotedTo } = await insertSymptom({
    foodEntryId: entryId,
    childId: child.id,
    observedAt: new Date(),
    label,
    note: null,
    createdBy: user.id,
    currentReaction: 'ras'
  });
  return promotedTo;
}

/** Stand-in for insertSymptom promoting a row between the edit form's load and its submit. */
export function promote(id: number, reaction: 'inconfort' | 'reaction'): void {
  testDb.update(foodEntries).set({ reaction }).where(eq(foodEntries.id, id)).run();
}

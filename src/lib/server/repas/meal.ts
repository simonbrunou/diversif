import { and, asc, eq } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import type { Executor, Tx } from './core';

// The meal rule, in one place: food_entries rows form a meal only when two or
// more of them share a non-null mealId. A repas of one aliment is a
// standalone entry with mealId null, never a "meal of one".

/** A new repas of `count` aliments: a fresh mealId for a meal, null for one aliment. */
export function newMealId(count: number): string | null {
  return count >= 2 ? crypto.randomUUID() : null;
}

const repasColumns = {
  id: foodEntries.id,
  foodId: foodEntries.foodId,
  foodName: foods.name,
  givenAt: foodEntries.givenAt,
  reaction: foodEntries.reaction,
  texture: foodEntries.texture,
  notes: foodEntries.notes,
  mealId: foodEntries.mealId
};

export type RepasRow = {
  id: number;
  foodId: number;
  foodName: string;
  givenAt: Date;
  reaction: (typeof foodEntries.$inferSelect)['reaction'];
  texture: (typeof foodEntries.$inferSelect)['texture'];
  notes: string | null;
  mealId: string | null;
};

export type RepasRows = {
  entry: RepasRow;
  /** Every row of the entry's meal (the entry included), or null for a standalone entry. */
  meal: { mealId: string; members: RepasRow[] } | null;
};

/** The child's entry and, by the meal rule, the meal it belongs to. Null if the child has no such entry. */
export function loadRepasRows(exec: Executor, childId: number, entryId: number): RepasRows | null {
  const entry = exec
    .select(repasColumns)
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
    .get();
  if (!entry) return null;
  const members = entry.mealId ? mealRows(exec, childId, entry.mealId) : [];
  return {
    entry,
    meal: members.length >= 2 ? { mealId: entry.mealId as string, members } : null
  };
}

function mealRows(exec: Executor, childId: number, mealId: string): RepasRow[] {
  return exec
    .select(repasColumns)
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.mealId, mealId), eq(foodEntries.childId, childId)))
    .orderBy(asc(foodEntries.id))
    .all();
}

/**
 * Re-apply the meal rule after a row left a meal: a lone survivor becomes a
 * standalone entry. Returns the surviving ids, lowest first.
 */
export function settleMeal(tx: Tx, childId: number, mealId: string): number[] {
  const rest = mealRows(tx, childId, mealId).map((row) => row.id);
  if (rest.length === 1) {
    tx.update(foodEntries)
      .set({ mealId: null, updatedAt: new Date() })
      .where(
        and(
          eq(foodEntries.id, rest[0]),
          eq(foodEntries.childId, childId),
          eq(foodEntries.mealId, mealId)
        )
      )
      .run();
  }
  return rest;
}

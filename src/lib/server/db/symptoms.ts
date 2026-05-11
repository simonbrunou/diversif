import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { foodEntries, symptoms } from './schema';
import type { SymptomLabel } from '$lib/content/symptoms';

export async function listSymptomsByEntry(foodEntryId: number) {
  const rows = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.foodEntryId, foodEntryId))
    .orderBy(asc(symptoms.observedAt));
  return rows.map((r) => ({
    id: r.id,
    label: r.label as SymptomLabel,
    observedAt: r.observedAt,
    note: r.note
  }));
}

export async function insertSymptom(input: {
  foodEntryId: number;
  childId: number;
  observedAt: Date;
  label: SymptomLabel;
  note: string | null;
  createdBy: number;
}): Promise<void> {
  await db.insert(symptoms).values({
    foodEntryId: input.foodEntryId,
    childId: input.childId,
    observedAt: input.observedAt,
    label: input.label,
    note: input.note,
    createdBy: input.createdBy
  });
}

export async function countNthExposition(foodEntryId: number): Promise<number> {
  const row = (
    await db
      .select({
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt
      })
      .from(foodEntries)
      .where(eq(foodEntries.id, foodEntryId))
      .limit(1)
  )[0];
  if (!row) return 0;
  const countRow = (
    await db
      .select({ count: sql<number>`count(*)::int` })
      .from(foodEntries)
      .where(
        and(
          eq(foodEntries.childId, row.childId),
          eq(foodEntries.foodId, row.foodId),
          lte(foodEntries.givenAt, row.givenAt)
        )
      )
  )[0];
  return countRow?.count ?? /* v8 ignore next */ 0;
}

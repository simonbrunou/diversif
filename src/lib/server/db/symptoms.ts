import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { foodEntries, symptoms } from './schema';
import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
import type { ReactionId } from '$lib/utils/reactions';

export interface InsertSymptomInput {
  foodEntryId: number;
  childId: number;
  observedAt: Date;
  label: SymptomLabel;
  note: string | null;
  createdBy: number;
  currentReaction: ReactionId;
}

export interface InsertSymptomResult {
  symptomId: number;
  promotedTo: Exclude<ReactionId, 'ras'> | null;
}

export async function insertSymptom(input: InsertSymptomInput): Promise<InsertSymptomResult> {
  // bun:sqlite transactions are synchronous: the callback runs inline and the
  // result is returned synchronously (no await inside).
  return db.transaction((tx) => {
    const [row] = tx
      .insert(symptoms)
      .values({
        foodEntryId: input.foodEntryId,
        childId: input.childId,
        observedAt: input.observedAt,
        label: input.label,
        note: input.note,
        createdBy: input.createdBy
      })
      .returning({ id: symptoms.id })
      .all();

    let promotedTo: Exclude<ReactionId, 'ras'> | null = null;
    if (input.currentReaction === 'ras') {
      const target = severityOf(input.label) === 'severe' ? 'reaction' : 'inconfort';
      const updated = tx
        .update(foodEntries)
        .set({ reaction: target, updatedAt: new Date() })
        .where(
          and(
            eq(foodEntries.id, input.foodEntryId),
            eq(foodEntries.childId, input.childId),
            eq(foodEntries.reaction, 'ras')
          )
        )
        .returning({ id: foodEntries.id })
        .all();
      if (updated.length > 0) promotedTo = target;
    }

    return { symptomId: row.id, promotedTo };
  });
}

export async function deleteSymptomById(input: {
  symptomId: number;
  foodEntryId: number;
  childId: number;
}): Promise<boolean> {
  const result = await db
    .delete(symptoms)
    .where(
      and(
        eq(symptoms.id, input.symptomId),
        eq(symptoms.foodEntryId, input.foodEntryId),
        eq(symptoms.childId, input.childId)
      )
    )
    .returning({ id: symptoms.id });
  return result.length > 0;
}

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
      .select({ count: sql<number>`count(*)` })
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

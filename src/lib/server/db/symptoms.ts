import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { foodEntries, symptoms } from './schema';
import { severityOf, type SymptomLabel } from '$lib/content/symptoms';

export type ReactionLevel = 'ras' | 'inconfort' | 'reaction';

export interface InsertSymptomInput {
  foodEntryId: number;
  childId: number;
  observedAt: Date;
  label: SymptomLabel;
  note: string | null;
  createdBy: number;
  currentReaction: ReactionLevel;
}

export interface InsertSymptomResult {
  symptomId: number;
  promotedTo: 'inconfort' | 'reaction' | null;
}

export async function insertSymptom(input: InsertSymptomInput): Promise<InsertSymptomResult> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(symptoms)
      .values({
        foodEntryId: input.foodEntryId,
        childId: input.childId,
        observedAt: input.observedAt,
        label: input.label,
        note: input.note,
        createdBy: input.createdBy
      })
      .returning({ id: symptoms.id });

    let promotedTo: 'inconfort' | 'reaction' | null = null;
    if (input.currentReaction === 'ras') {
      const target = severityOf(input.label) === 'severe' ? 'reaction' : 'inconfort';
      const updated = await tx
        .update(foodEntries)
        .set({ reaction: target })
        .where(
          and(
            eq(foodEntries.id, input.foodEntryId),
            eq(foodEntries.childId, input.childId),
            eq(foodEntries.reaction, 'ras')
          )
        )
        .returning({ id: foodEntries.id });
      if (updated.length > 0) promotedTo = target;
    }

    return { symptomId: row.id, promotedTo };
  });
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

import { error } from '@sveltejs/kit';
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
    // Defense-in-depth: the symptom may only attach to an entry that actually
    // belongs to `childId`. Callers already guard via loadEntryForChild, but
    // re-checking inside the transaction makes this helper self-contained — a
    // future caller can't cross tenants by passing a foreign foodEntryId with
    // a guarded childId.
    const owner = tx
      .select({ id: foodEntries.id })
      .from(foodEntries)
      .where(and(eq(foodEntries.id, input.foodEntryId), eq(foodEntries.childId, input.childId)))
      .limit(1)
      .all();
    if (owner.length === 0) {
      throw error(404, 'Food entry not found');
    }

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

export async function listSymptomsByEntry(foodEntryId: number, childId: number) {
  const rows = await db
    .select()
    .from(symptoms)
    // Scope by childId too so the read is self-contained: a foreign entryId
    // (even one passed alongside a guarded childId) can never surface another
    // child's symptoms.
    .where(and(eq(symptoms.foodEntryId, foodEntryId), eq(symptoms.childId, childId)))
    .orderBy(asc(symptoms.observedAt));
  return rows.map((r) => ({
    id: r.id,
    label: r.label as SymptomLabel,
    observedAt: r.observedAt,
    note: r.note
  }));
}

export async function countNthExposition(foodEntryId: number, childId: number): Promise<number> {
  const row = (
    await db
      .select({
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt
      })
      .from(foodEntries)
      // Anchor the lookup to childId: a foreign entryId resolves to no row and
      // the count is 0, rather than leaking another child's exposition count.
      .where(and(eq(foodEntries.id, foodEntryId), eq(foodEntries.childId, childId)))
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

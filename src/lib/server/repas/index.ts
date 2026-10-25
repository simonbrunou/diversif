import { and, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { children, foodEntries } from '#lib/server/db/schema.js';
import { audit } from '#lib/server/audit.js';
import {
  IdempotencyInFlight,
  IdempotencyScopeMismatch,
  withIdempotencyKey
} from '#lib/server/idempotency.js';
import { mealDateError } from '#lib/utils/meal-date.js';
import { milestonesPath, type Milestones } from '#lib/utils/milestones.js';
import { moreSevere, type ReactionId, type ReactionsByEntry } from '#lib/utils/reaction-values.js';
import type { TextureKey } from '#lib/utils/textures.js';
import { resolveAliments } from './aliments';
import { RepasAbort, refuse, type RepasErrorKey, type Tx } from './core';
import {
  idempotencyKeyField,
  parseEntryEditForm,
  parseLogForm,
  parseMealEditForm,
  removeIdField,
  type LogDraft,
  type ReactionEdit
} from './fields';
import { loadRepasRows, newMealId, settleMeal, type RepasRow, type RepasRows } from './meal';
import { measureMilestones, milestoneBaseline } from './milestones';
import { recordPreparedMeal } from './prepared-meal';

// The repas write module. A repas is what the baby ate at one time: one
// food_entries row per aliment, grouped by a shared mealId when there are two
// or more (the meal rule, src/lib/server/repas/meal.ts). Every write the log
// and edit pages make to a repas goes through the functions below, each one
// transaction: the routes only turn FormData into a call and the result into
// fail() or a redirect. (A symptom's reaction promotion is the one other
// writer, in src/lib/server/db/symptoms.ts; writeReactions below respects it.)

/** Who writes, for which child: requireChildContext's result fits as-is. */
export type RepasContext = { childId: number; user: { id: number } };

/** A refused write. Nothing was written. */
export type RepasRefusal = {
  ok: false;
  status: 400 | 404 | 409;
  errorKey: RepasErrorKey;
  /** With errorsLogReactionChanged: every row's stored reaction, by entry id, for the form to show. */
  reactions?: ReactionsByEntry;
};

/** A repas just written by logRepas. */
type Logged = {
  /** The unlocalized dashboard path carrying the encoded milestones. */
  redirect: string;
  entryIds: number[];
  milestones: Milestones;
};

export type LogResult =
  | RepasRefusal
  | ({ ok: true; replayed: false } & Logged)
  /** An idempotency-key replay: nothing was written, `redirect` is the first submit's. */
  | { ok: true; replayed: true; redirect: string };

export type RepasView = {
  entry: {
    id: number;
    foodId: number;
    givenAt: Date;
    reaction: ReactionId;
    texture: TextureKey | null;
    notes: string | null;
  };
  meal: {
    mealId: string;
    members: { id: number; foodId: number; foodName: string; reaction: ReactionId }[];
  } | null;
};

// Run a write and turn the module's own refusals into values. Anything else
// (a constraint the parser should have caught, a dead database) still throws.
function refusing<T>(write: () => T): T | RepasRefusal {
  try {
    return write();
  } catch (e) {
    if (e instanceof RepasAbort) {
      const { status, errorKey, reactions } = e;
      return { ok: false, status, errorKey, ...(reactions && { reactions }) };
    }
    if (e instanceof IdempotencyInFlight || e instanceof IdempotencyScopeMismatch) {
      return { ok: false, status: 409, errorKey: 'errorsLogIdempotencyConflict' };
    }
    throw e;
  }
}

// Bound givenAt to [child's birth day, now + tolerance], read in the same
// transaction as the write it guards.
function checkMealDate(tx: Tx, childId: number, givenAt: Date): void {
  const child = tx
    .select({ birthDate: children.birthDate })
    .from(children)
    .where(eq(children.id, childId))
    .get();
  const error = child ? mealDateError(givenAt, child.birthDate, Date.now()) : null;
  if (error) refuse(error);
}

function existingRepas(tx: Tx, childId: number, entryId: number): RepasRows {
  return loadRepasRows(tx, childId, entryId) ?? notFound();
}

function notFound(): never {
  throw new RepasAbort(404, 'errorsFoodEntryNotFound');
}

function insertRepas(tx: Tx, ctx: RepasContext, draft: LogDraft): Logged {
  const aliments = resolveAliments(tx, ctx.childId, draft.aliments);
  const now = new Date();
  // Snapshot BEFORE any insert so milestones compare pre/post state.
  const baseline = milestoneBaseline(tx, ctx.childId, now.getTime());

  const mealId = newMealId(aliments.length);
  const entryIds = aliments.map(
    (food) =>
      tx
        .insert(foodEntries)
        .values({
          childId: ctx.childId,
          foodId: food.id,
          givenAt: draft.givenAt,
          reaction: draft.reaction,
          texture: draft.texture,
          notes: draft.notes,
          loggedBy: ctx.user.id,
          createdAt: now,
          updatedAt: now,
          mealId
        })
        .returning({ id: foodEntries.id })
        .all()[0].id
  );
  const foodIds = aliments.map((food) => food.id);
  recordPreparedMeal(tx, ctx.childId, draft.preparedMeal, foodIds, draft.givenAt);

  const milestones = measureMilestones(tx, ctx.childId, baseline, now.getTime());
  return { redirect: milestonesPath(ctx.childId, milestones), entryIds, milestones };
}

/**
 * Log a new repas from the log form. With an idempotency key (the form's
 * `idempotencyKey` field), a second submit under the same key replays the
 * first one's redirect without writing.
 */
export function logRepas(ctx: RepasContext, form: FormData): LogResult {
  return refusing(() => {
    const key = idempotencyKeyField(form);
    const draft = parseLogForm(form);
    let fresh = null as Logged | null;

    const redirect = db.transaction((tx) => {
      checkMealDate(tx, ctx.childId, draft.givenAt);
      const work = () => (fresh = insertRepas(tx, ctx, draft));
      if (!key) return work().redirect;
      // Pruning expired keys runs in the periodic cleanup task, not here:
      // doing it inside this transaction would hold the single SQLite writer.
      return withIdempotencyKey(
        tx,
        { key, userId: ctx.user.id, scope: `log:child:${ctx.childId}` },
        work
      ).redirect;
    });

    if (!fresh) return { ok: true, replayed: true, redirect };
    audit({
      type: 'food_entry.created',
      userId: ctx.user.id,
      childId: ctx.childId,
      count: fresh.entryIds.length
    });
    return { ok: true, replayed: false, ...fresh };
  });
}

/** The entry and, by the meal rule, its meal, for the edit page. Null if the child has no such entry. */
export function readRepas(ctx: Pick<RepasContext, 'childId'>, entryId: number): RepasView | null {
  const rows = loadRepasRows(db, ctx.childId, entryId);
  if (!rows) return null;
  const { id, foodId, givenAt, reaction, texture, notes } = rows.entry;
  return {
    entry: { id, foodId, givenAt, reaction, texture, notes },
    meal: rows.meal && {
      mealId: rows.meal.mealId,
      members: rows.meal.members.map((m) => ({
        id: m.id,
        foodId: m.foodId,
        foodName: m.foodName,
        reaction: m.reaction
      }))
    }
  };
}

// Dirty-only reaction writes for the repas `rows`, `edits` keyed by entry id:
// a row's reaction changes only when the parent picked a value other than the
// one the form loaded. The rows were read in this transaction, and bun:sqlite
// runs it synchronously, so `row.reaction` is the value a write replaces. When
// it no longer matches what the form loaded, a symptom (or a co-parent)
// changed the reaction since, and the more severe value wins (#445): the
// parent's pick is written when it is more severe, the change stands when they
// are equal, and a less severe pick refuses the whole edit, so a stale form
// never downgrades a promotion (#421) and the parent is told. The refusal
// carries every row's stored reaction for the form to show.
function writeReactions(
  tx: Tx,
  childId: number,
  rows: RepasRow[],
  edits: Map<number, ReactionEdit>
): void {
  for (const row of rows) {
    const edit = edits.get(row.id);
    if (!edit) continue;
    const loaded = edit.loaded ?? row.reaction;
    if (edit.to === loaded || edit.to === row.reaction) continue;
    if (row.reaction !== loaded && moreSevere(edit.to, row.reaction) !== edit.to) {
      const stored = Object.fromEntries(rows.map((r) => [r.id, r.reaction]));
      throw new RepasAbort(409, 'errorsLogReactionChanged', stored);
    }
    tx.update(foodEntries)
      .set({ reaction: edit.to, updatedAt: new Date() })
      .where(and(eq(foodEntries.id, row.id), eq(foodEntries.childId, childId)))
      .run();
  }
}

function editEntry(tx: Tx, childId: number, entry: RepasRow, form: FormData): void {
  const draft = parseEntryEditForm(form);
  // Bound the date before resolving the aliment, so a rejected edit fails
  // before inserting a new custom aliment (the rollback would undo it anyway).
  checkMealDate(tx, childId, draft.givenAt);
  const [food] = resolveAliments(tx, childId, draft.aliments);
  tx.update(foodEntries)
    .set({
      foodId: food.id,
      givenAt: draft.givenAt,
      texture: draft.texture,
      notes: draft.notes,
      updatedAt: new Date()
    })
    .where(and(eq(foodEntries.id, entry.id), eq(foodEntries.childId, childId)))
    .run();
  writeReactions(tx, childId, [entry], new Map([[entry.id, draft.reaction]]));
}

function editMeal(tx: Tx, childId: number, meal: NonNullable<RepasRows['meal']>, form: FormData) {
  const draft = parseMealEditForm(
    form,
    meal.members.map((m) => m.id)
  );
  checkMealDate(tx, childId, draft.givenAt);
  // Shared fields go to every row of the meal; reactions stay per aliment.
  tx.update(foodEntries)
    .set({
      givenAt: draft.givenAt,
      texture: draft.texture,
      notes: draft.notes,
      updatedAt: new Date()
    })
    .where(and(eq(foodEntries.mealId, meal.mealId), eq(foodEntries.childId, childId)))
    .run();
  writeReactions(tx, childId, meal.members, draft.reactions);
}

/**
 * Edit the repas an entry belongs to: the single-entry form for a standalone
 * entry, the meal form (shared fields + one reaction per aliment) for a meal.
 */
export function editRepas(
  ctx: RepasContext,
  entryId: number,
  form: FormData
): RepasRefusal | { ok: true } {
  return refusing(() => {
    db.transaction((tx) => {
      const repas = existingRepas(tx, ctx.childId, entryId);
      if (repas.meal) editMeal(tx, ctx.childId, repas.meal, form);
      else editEntry(tx, ctx.childId, repas.entry, form);
    });
    audit({ type: 'food_entry.updated', userId: ctx.user.id, childId: ctx.childId, entryId });
    return { ok: true as const };
  });
}

/**
 * Remove one ingrédient, an aliment's row (the form's `removeId`), from the
 * meal `entryId` belongs to: the « Retirer » action. Returns the surviving
 * entry to land on: the lowest remaining id, never the removed one (which is
 * often the entry the editor was opened on).
 */
export function removeIngredient(
  ctx: RepasContext,
  entryId: number,
  form: FormData
): RepasRefusal | { ok: true; landOn: number } {
  return refusing(() => {
    const landOn = db.transaction((tx) => {
      const { meal } = existingRepas(tx, ctx.childId, entryId);
      if (!meal) refuse('errorsLogInvalidRequest');
      const removeId = removeIdField(form);
      // Scoped to the meal: an id that already left it (a co-parent removed it
      // first) deletes nothing and the editor lands on the meal as it is now.
      tx.delete(foodEntries)
        .where(
          and(
            eq(foodEntries.id, removeId),
            eq(foodEntries.childId, ctx.childId),
            eq(foodEntries.mealId, meal.mealId)
          )
        )
        .run();
      return settleMeal(tx, ctx.childId, meal.mealId)[0];
    });
    audit({ type: 'food_entry.updated', userId: ctx.user.id, childId: ctx.childId, entryId });
    return { ok: true as const, landOn };
  });
}

/** Delete one entry. If it leaves a meal of one, that survivor becomes a standalone entry. */
export function deleteEntry(ctx: RepasContext, entryId: number): RepasRefusal | { ok: true } {
  return refusing(() => {
    db.transaction((tx) => {
      const { meal } = existingRepas(tx, ctx.childId, entryId);
      tx.delete(foodEntries)
        .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, ctx.childId)))
        .run();
      if (meal) settleMeal(tx, ctx.childId, meal.mealId);
    });
    audit({ type: 'food_entry.deleted', userId: ctx.user.id, childId: ctx.childId, entryId });
    return { ok: true as const };
  });
}

/** Delete every row of the meal `entryId` belongs to. Refused for a standalone entry. */
export function deleteMeal(ctx: RepasContext, entryId: number): RepasRefusal | { ok: true } {
  return refusing(() => {
    db.transaction((tx) => {
      const { meal } = existingRepas(tx, ctx.childId, entryId);
      if (!meal) refuse('errorsLogMealNotFound');
      tx.delete(foodEntries)
        .where(and(eq(foodEntries.mealId, meal.mealId), eq(foodEntries.childId, ctx.childId)))
        .run();
    });
    audit({ type: 'food_entry.deleted', userId: ctx.user.id, childId: ctx.childId, entryId });
    return { ok: true as const };
  });
}

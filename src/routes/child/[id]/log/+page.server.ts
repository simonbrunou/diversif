import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { requireChildContext } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import { resolveOrInsertFood } from '$lib/server/food-resolution';
import { newId } from '$lib/offline/uuid';
import { TEXTURE_VALUES } from '$lib/utils/textures';
import { REACTION_VALUES } from '$lib/utils/reaction-values';
import { ALLERGENS } from '$lib/utils/allergens';
import {
  IdempotencyInFlight,
  IdempotencyScopeMismatch,
  withIdempotencyKey
} from '$lib/server/idempotency';
import type { Actions, PageServerLoad } from './$types';

const schema = z
  .object({
    foodIds: z
      .array(z.coerce.number().int().positive())
      .max(20, 'Un repas ne peut pas contenir plus de 20 aliments.')
      .default([]),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(REACTION_VALUES),
    texture: z.enum(TEXTURE_VALUES).optional(),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => d.foodIds.length > 0 || !!d['customFood.name'], {
    message: 'Choisissez un aliment ou créez-en un.'
  });

export const load: PageServerLoad = async ({ locals, params }) => {
  const { childId } = requireChildContext(locals, params);

  const list = await db
    .select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      allergenType: foods.allergenType
    })
    .from(foods)
    .where(or(isNull(foods.customForChildId), eq(foods.customForChildId, childId)))
    .orderBy(foods.name);

  // Distinct foodIds already logged for this child, so the picker can badge
  // a "never tried" hint when several brand-new foods are selected together.
  const introduced = await db
    .selectDistinct({ foodId: foodEntries.foodId })
    .from(foodEntries)
    .where(eq(foodEntries.childId, childId));

  return { foods: list, introducedFoodIds: introduced.map((r) => r.foodId) };
};

class LogActionAbort extends Error {
  constructor(
    public readonly status: number,
    public readonly userMessage: string
  ) {
    super(userMessage);
    this.name = 'LogActionAbort';
  }
}

type LogTx = NonNullable<Parameters<typeof resolveOrInsertFood>[1]>;

// Categories covered for a child, excluding the `autre` bucket so this count
// shares a denominator with the dashboard's totalCategories (CATEGORIES.length - 1).
function countCategoriesCovered(tx: LogTx, childId: number): number {
  return (
    tx
      .select({ n: sql<number>`count(distinct ${foods.category})` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
      .limit(1)
      .all()[0]?.n /* v8 ignore next */ ?? 0
  );
}

type PriorLogState = {
  priorEntryCount: number;
  priorCategoriesCovered: number;
  priorTypes: Set<string>; // allergen types already introduced, pre-insert
  priorAllergensIntroduced: number; // = priorTypes.size, kept for readability
};

// Snapshot pre-insert state so the caller can detect milestones (first food,
// first allergen(s), all-allergens, category progress) once the meal's
// entries are inserted. priorTypes MUST be read here, before any insert in
// this transaction: querying allergen types after the insert loop would
// include the meal's own just-inserted rows, so every "first allergen" would
// look already-seen and the celebration would never fire.
function snapshotPriorState(tx: LogTx, childId: number): PriorLogState {
  const priorEntryCount =
    tx
      .select({ n: sql<number>`count(*)` })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
      .limit(1)
      .all()[0]?.n /* v8 ignore next */ ?? 0;

  const priorTypes = new Set(
    tx
      .select({ t: foods.allergenType })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} is not null`))
      .all()
      .map((r) => r.t as string)
  );

  return {
    priorEntryCount,
    priorCategoriesCovered: countCategoriesCovered(tx, childId),
    priorTypes,
    priorAllergensIntroduced: priorTypes.size
  };
}

// Distinct allergen types introduced for this child, post-insert. Paired with
// the pre-insert snapshot's priorAllergensIntroduced, this detects a meal
// batch crossing the "all 12 allergens" finish line even when it introduces
// more than one new type at once.
function distinctAllergensIntroduced(tx: LogTx, childId: number): number {
  return (
    tx
      .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} is not null`))
      .limit(1)
      .all()[0]?.n /* v8 ignore next */ ?? 0
  );
}

// Resolve every posted foodId (deduped) plus an optional single custom food
// into the list of foods this submit will insert as one meal. Extracted out
// of the action's work() so each function stays under the repo's cognitive-
// complexity gate: this owns the "loop + validate + dedupe" branching on its
// own budget instead of nesting it inside work()'s.
function resolveMealFoods(
  tx: LogTx,
  childId: number,
  foodIds: number[],
  customName: string | undefined,
  customCategory: string | undefined
): { food: typeof foods.$inferSelect; foodId: number }[] {
  const resolvedFoods: { food: typeof foods.$inferSelect; foodId: number }[] = [];
  const seen = new Set<number>();

  for (const id of foodIds) {
    const r = resolveOrInsertFood({ foodId: id, childId }, tx);
    if (!r.ok)
      throw new LogActionAbort(
        400,
        r.reason === 'not-found' ? 'Aliment introuvable.' : 'Aliment invalide.'
      );
    if (!seen.has(r.foodId)) {
      seen.add(r.foodId);
      resolvedFoods.push({ food: r.food, foodId: r.foodId });
    }
  }

  if (customName) {
    const r = resolveOrInsertFood({ customName, customCategory, childId }, tx);
    if (!r.ok) throw new LogActionAbort(400, 'Aliment invalide.');
    if (!seen.has(r.foodId)) {
      seen.add(r.foodId);
      resolvedFoods.push({ food: r.food, foodId: r.foodId });
    }
  }

  if (resolvedFoods.length === 0) throw new LogActionAbort(400, 'Aucun aliment sélectionné.');
  return resolvedFoods;
}

// Build the post-log redirect URL, encoding the milestones the dashboard
// celebrates (first entry, first allergen, all-allergens, category progress).
function buildLogRedirect(
  childId: number,
  opts: {
    priorEntryCount: number;
    isFirstAllergen: boolean;
    allergenType: string | null;
    allAllergensJustCompleted: boolean;
    categoriesNowCovered: number;
    priorCategoriesCovered: number;
  }
): { redirect: string } {
  const search = new URLSearchParams({ logged: '1' });
  if (opts.priorEntryCount === 0) search.set('first', '1');
  if (opts.isFirstAllergen) search.set('allergen', opts.allergenType as string);
  if (opts.allAllergensJustCompleted) search.set('allAllergens', '1');
  search.set('categories', String(opts.categoriesNowCovered));
  search.set('prevCategories', String(opts.priorCategoriesCovered));
  return { redirect: `/child/${childId}?${search.toString()}` };
}

// Compute this meal's milestones set-based across every resolved food (not
// just the first) and build the redirect. Extracted out of work() to keep
// its cognitive complexity under the repo's fallow gate.
function buildMealMilestoneRedirect(
  tx: LogTx,
  childId: number,
  resolvedFoods: { food: typeof foods.$inferSelect; foodId: number }[],
  prior: PriorLogState
): { redirect: string } {
  const afterDistinct = distinctAllergensIntroduced(tx, childId); // post-insert
  const mealTypes = resolvedFoods.map((r) => r.food.allergenType).filter((t): t is string => !!t);
  const newTypes = mealTypes.filter((t) => !prior.priorTypes.has(t));
  // Deterministic pick: first in ALLERGENS declaration order among the
  // meal's newly-introduced types.
  const firstAllergen = ALLERGENS.map((a) => a.id).find((id) => newTypes.includes(id)) ?? null;

  return buildLogRedirect(childId, {
    priorEntryCount: prior.priorEntryCount,
    isFirstAllergen: firstAllergen !== null,
    allergenType: firstAllergen,
    allAllergensJustCompleted:
      afterDistinct === ALLERGENS.length && prior.priorAllergensIntroduced < ALLERGENS.length,
    categoriesNowCovered: countCategoriesCovered(tx, childId),
    priorCategoriesCovered: prior.priorCategoriesCovered
  });
}

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (
      idempotencyKey != null &&
      (idempotencyKey.length > 100 || !/^[A-Za-z0-9_-]+$/.test(idempotencyKey))
    ) {
      return fail(400, { error: 'Idempotency-Key invalide' });
    }

    const fd = await request.formData();
    // Object.fromEntries(fd) would silently drop repeated `foodId` fields
    // (later keys overwrite earlier ones), so multi-ingredient submits must
    // read them via getAll instead.
    const raw = { ...Object.fromEntries(fd), foodIds: fd.getAll('foodId').map(String) };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    const givenAtDate = new Date(parsed.data.givenAt);
    if (Number.isNaN(givenAtDate.getTime())) {
      return fail(400, { error: 'Date invalide.' });
    }

    let redirectPath: string;
    // Set only on a real insert inside the tx below, so the audit after the
    // commit doesn't double-count an idempotent offline-queue replay (which
    // returns the cached redirect without inserting a row).
    let didInsert = false;
    // Count of distinct food_entries rows actually inserted, for the audit
    // event below. Same closure-capture pattern as didInsert.
    let insertedCount = 0;
    try {
      // bun:sqlite transactions are synchronous: the callback (and `work`)
      // run inline with no awaits; the database serializes writers for us.
      redirectPath = db.transaction((tx) => {
        const work = (): { redirect: string } => {
          const resolvedFoods = resolveMealFoods(
            tx,
            childId,
            parsed.data.foodIds,
            parsed.data['customFood.name'],
            parsed.data['customFood.category']
          );

          // Snapshot BEFORE any insert so milestones compare pre/post state,
          // across every food in the meal (not just the first).
          const prior = snapshotPriorState(tx, childId);

          const mealId = resolvedFoods.length > 1 ? newId() : null;
          for (const { foodId } of resolvedFoods) {
            tx.insert(foodEntries)
              .values({
                childId,
                foodId,
                givenAt: givenAtDate,
                reaction: parsed.data.reaction,
                texture: parsed.data.texture ?? null,
                notes: parsed.data.notes?.trim() || null,
                loggedBy: user.id,
                createdAt: new Date(),
                updatedAt: new Date(),
                mealId
              })
              .run();
          }
          didInsert = true;
          insertedCount = resolvedFoods.length;

          return buildMealMilestoneRedirect(tx, childId, resolvedFoods, prior);
        };

        if (idempotencyKey) {
          const result = withIdempotencyKey(
            tx,
            { key: idempotencyKey, userId: user.id, scope: `log:child:${childId}` },
            work
          );
          // Pruning of expired idempotency_keys runs in the periodic cleanup
          // task, not here — doing it inside the user transaction would hold the
          // single SQLite writer across every concurrent log POST.
          return result.redirect;
        }
        return work().redirect;
      });
    } catch (e) {
      if (e instanceof LogActionAbort) {
        return fail(e.status, { error: e.userMessage });
      }
      if (e instanceof IdempotencyInFlight || e instanceof IdempotencyScopeMismatch) {
        return fail(409, { error: "Conflit de clé d'idempotence" });
      }
      throw e;
    }

    if (didInsert)
      audit({ type: 'food_entry.created', userId: user.id, childId, count: insertedCount });
    throw localizedRedirect(locals.locale, 303, redirectPath);
  }
};

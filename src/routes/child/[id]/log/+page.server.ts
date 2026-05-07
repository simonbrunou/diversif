import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { requireMembership } from '$lib/server/guards';
import { CATEGORY_IDS } from '$lib/utils/categories';
import { ALLERGENS } from '$lib/utils/allergens';
import {
  IdempotencyInFlight,
  IdempotencyScopeMismatch,
  pruneExpiredKeys,
  withIdempotencyKey
} from '$lib/server/idempotency';
import type { Actions, PageServerLoad } from './$types';

const schema = z
  .object({
    foodId: z.coerce.number().int().positive().optional(),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(['ras', 'inconfort', 'reaction']),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => !!d.foodId || !!d['customFood.name'], {
    message: 'Choisissez un aliment ou créez-en un.'
  });

export const load: PageServerLoad = async ({ locals, params }) => {
  const childId = Number(params.id);
  requireMembership(locals, childId);

  const list = db
    .select({
      id: foods.id,
      name: foods.name,
      category: foods.category,
      allergenType: foods.allergenType
    })
    .from(foods)
    .where(or(isNull(foods.customForChildId), eq(foods.customForChildId, childId)))
    .orderBy(foods.name)
    .all();

  return { foods: list };
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

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const childId = Number(params.id);
    const { user } = requireMembership(locals, childId);

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (
      idempotencyKey != null &&
      (idempotencyKey.length > 100 || !/^[A-Za-z0-9_-]+$/.test(idempotencyKey))
    ) {
      return fail(400, { error: 'Idempotency-Key invalide' });
    }

    const raw = Object.fromEntries(await request.formData());
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
    try {
      redirectPath = db.transaction((tx) => {
        const work = (): { redirect: string } => {
          let foodId = parsed.data.foodId ?? null;
          const customName = parsed.data['customFood.name']?.trim();
          const customCategoryRaw = parsed.data['customFood.category']?.trim();

          if (!foodId && customName) {
            const category = CATEGORY_IDS.includes(customCategoryRaw ?? /* v8 ignore next */ '')
              ? (customCategoryRaw as string)
              : 'autre';
            const inserted = tx
              .insert(foods)
              .values({
                name: customName,
                category,
                isMajorAllergen: false,
                allergenType: null,
                suggestedAgeMonths: 0,
                notes: null,
                isCustom: true,
                customForChildId: childId
              })
              .returning({ id: foods.id })
              .get();
            foodId = inserted.id;
          }

          if (!foodId) {
            throw new LogActionAbort(400, 'Aucun aliment sélectionné.');
          }

          // Verify the food belongs to this child or is from the global catalog.
          const food = tx
            .select()
            .from(foods)
            .where(
              and(
                eq(foods.id, foodId),
                or(isNull(foods.customForChildId), eq(foods.customForChildId, childId))
              )
            )
            .get();
          if (!food) {
            throw new LogActionAbort(400, 'Aliment introuvable.');
          }

          // Snapshot pre-insert state so we can detect milestones after the insert.
          const priorEntryCount =
            tx
              .select({ n: sql<number>`count(*)` })
              .from(foodEntries)
              .where(eq(foodEntries.childId, childId))
              .get()?.n /* v8 ignore next */ ?? 0;

          // Mirror loadDiversityMetrics: exclude the `autre` bucket so this count
          // shares a denominator with the dashboard's totalCategories (CATEGORIES.length - 1).
          const priorCategoriesCovered =
            tx
              .select({ n: sql<number>`count(distinct ${foods.category})` })
              .from(foodEntries)
              .innerJoin(foods, eq(foods.id, foodEntries.foodId))
              .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
              .get()?.n /* v8 ignore next */ ?? 0;

          const priorAllergenCount =
            food.allergenType != null
              ? (tx
                  .select({ n: sql<number>`count(*)` })
                  .from(foodEntries)
                  .innerJoin(foods, eq(foods.id, foodEntries.foodId))
                  .where(
                    and(eq(foodEntries.childId, childId), eq(foods.allergenType, food.allergenType))
                  )
                  .get()?.n /* v8 ignore next */ ?? 0)
              : null;

          // Distinct allergens introduced for this child, pre-insert. Used to detect
          // crossing the "all 12 allergens" finish line on the *new* introduction.
          const priorAllergensIntroduced =
            tx
              .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
              .from(foodEntries)
              .innerJoin(foods, eq(foods.id, foodEntries.foodId))
              .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} IS NOT NULL`))
              .get()?.n /* v8 ignore next */ ?? 0;

          tx.insert(foodEntries)
            .values({
              childId,
              foodId,
              givenAt: givenAtDate,
              reaction: parsed.data.reaction,
              notes: parsed.data.notes?.trim() || null,
              loggedBy: user.id,
              createdAt: new Date()
            })
            .run();

          const categoriesNowCovered =
            tx
              .select({ n: sql<number>`count(distinct ${foods.category})` })
              .from(foodEntries)
              .innerJoin(foods, eq(foods.id, foodEntries.foodId))
              .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
              .get()?.n /* v8 ignore next */ ?? 0;

          const isFirstAllergen = priorAllergenCount === 0 && food.allergenType != null;
          const allAllergensJustCompleted =
            isFirstAllergen && priorAllergensIntroduced + 1 === ALLERGENS.length;

          const search = new URLSearchParams({ logged: '1' });
          if (priorEntryCount === 0) search.set('first', '1');
          if (isFirstAllergen) search.set('allergen', food.allergenType as string);
          if (allAllergensJustCompleted) search.set('allAllergens', '1');
          search.set('categories', String(categoriesNowCovered));
          search.set('prevCategories', String(priorCategoriesCovered));
          return { redirect: `/child/${childId}?${search.toString()}` };
        };

        if (idempotencyKey) {
          const result = withIdempotencyKey(
            tx,
            { key: idempotencyKey, userId: user.id, scope: `log:child:${childId}` },
            work
          );
          pruneExpiredKeys(tx);
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

    throw redirect(303, redirectPath);
  }
};

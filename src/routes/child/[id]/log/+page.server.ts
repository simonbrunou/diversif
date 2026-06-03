import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { requireChildContext } from '$lib/server/guards';
import { resolveOrInsertFood } from '$lib/server/food-resolution';
import { TEXTURE_VALUES } from '$lib/utils/textures';
import { ALLERGENS } from '$lib/utils/allergens';
import {
  IdempotencyInFlight,
  IdempotencyScopeMismatch,
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
    texture: z.enum(TEXTURE_VALUES).optional(),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => !!d.foodId || !!d['customFood.name'], {
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
    const { user, childId } = requireChildContext(locals, params);

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
      // bun:sqlite transactions are synchronous: the callback (and `work`)
      // run inline with no awaits; the database serializes writers for us.
      redirectPath = db.transaction((tx) => {
        const work = (): { redirect: string } => {
          const resolved = resolveOrInsertFood(
            {
              foodId: parsed.data.foodId ?? null,
              customName: parsed.data['customFood.name'],
              customCategory: parsed.data['customFood.category'],
              childId
            },
            tx
          );
          if (!resolved.ok) {
            throw new LogActionAbort(
              400,
              resolved.reason === 'not-found'
                ? 'Aliment introuvable.'
                : 'Aucun aliment sélectionné.'
            );
          }
          const { food, foodId } = resolved;

          // Snapshot pre-insert state so we can detect milestones (first food,
          // first allergen, all-allergens) after the insert below.
          const priorEntryCount =
            tx
              .select({ n: sql<number>`count(*)` })
              .from(foodEntries)
              .where(eq(foodEntries.childId, childId))
              .limit(1)
              .all()[0]?.n /* v8 ignore next */ ?? 0;

          // Mirror loadDiversityMetrics: exclude the `autre` bucket so this count
          // shares a denominator with the dashboard's totalCategories (CATEGORIES.length - 1).
          const priorCategoriesCovered =
            tx
              .select({ n: sql<number>`count(distinct ${foods.category})` })
              .from(foodEntries)
              .innerJoin(foods, eq(foods.id, foodEntries.foodId))
              .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
              .limit(1)
              .all()[0]?.n /* v8 ignore next */ ?? 0;

          const priorAllergenCount =
            food.allergenType != null
              ? (tx
                  .select({ n: sql<number>`count(*)` })
                  .from(foodEntries)
                  .innerJoin(foods, eq(foods.id, foodEntries.foodId))
                  .where(
                    and(eq(foodEntries.childId, childId), eq(foods.allergenType, food.allergenType))
                  )
                  .limit(1)
                  .all()[0]?.n /* v8 ignore next */ ?? 0)
              : null;

          // Distinct allergens introduced for this child, pre-insert. Used to detect
          // crossing the "all 12 allergens" finish line on the *new* introduction.
          const priorAllergensIntroduced =
            tx
              .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
              .from(foodEntries)
              .innerJoin(foods, eq(foods.id, foodEntries.foodId))
              .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} IS NOT NULL`))
              .limit(1)
              .all()[0]?.n /* v8 ignore next */ ?? 0;

          tx.insert(foodEntries)
            .values({
              childId,
              foodId,
              givenAt: givenAtDate,
              reaction: parsed.data.reaction,
              texture: parsed.data.texture ?? null,
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
              .limit(1)
              .all()[0]?.n /* v8 ignore next */ ?? 0;

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

    throw localizedRedirect(locals.locale, 303, redirectPath);
  }
};

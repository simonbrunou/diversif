import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { requireMembership } from '$lib/server/guards';
import { CATEGORY_IDS } from '$lib/utils/categories';
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

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const childId = Number(params.id);
    const { user } = requireMembership(locals, childId);

    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    let foodId = parsed.data.foodId ?? null;
    const customName = parsed.data['customFood.name']?.trim();
    const customCategoryRaw = parsed.data['customFood.category']?.trim();

    if (!foodId && customName) {
      const category = CATEGORY_IDS.includes(customCategoryRaw ?? /* v8 ignore next */ '')
        ? (customCategoryRaw as string)
        : 'autre';
      const inserted = db
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
      return fail(400, { error: 'Aucun aliment sélectionné.' });
    }

    // Verify the food belongs to this child or is from the global catalog.
    const food = db
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
      return fail(400, { error: 'Aliment introuvable.' });
    }

    const givenAtDate = new Date(parsed.data.givenAt);
    if (Number.isNaN(givenAtDate.getTime())) {
      return fail(400, { error: 'Date invalide.' });
    }

    db.insert(foodEntries)
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

    throw redirect(303, `/child/${childId}?logged=1`);
  }
};

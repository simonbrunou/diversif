import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { requireMembership, requireUser } from '$lib/server/guards';
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

function parseEntryId(value: string | undefined): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw error(404, 'Entrée introuvable');
  return id;
}

function loadEntry(entryId: number, childId: number) {
  const row = db
    .select()
    .from(foodEntries)
    .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
    .get();
  if (!row) throw error(404, 'Entrée introuvable');
  return row;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  requireUser(locals);
  const childId = Number(params.id);
  requireMembership(locals, childId);
  const entryId = parseEntryId(params.entryId);

  const entry = loadEntry(entryId, childId);

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

  // Drizzle's timestamp_ms mode always materializes givenAt as a Date.
  const givenAt = entry.givenAt as Date;

  const from = url.searchParams.get('from') === 'dashboard' ? 'dashboard' : 'foods';

  return {
    foods: list,
    entry: {
      id: entry.id,
      foodId: entry.foodId,
      givenAt: givenAt.getTime(),
      reaction: entry.reaction,
      notes: entry.notes
    },
    from
  };
};

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    requireUser(locals);
    const childId = Number(params.id);
    requireMembership(locals, childId);
    const entryId = parseEntryId(params.entryId);
    loadEntry(entryId, childId);

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

    db.update(foodEntries)
      .set({
        foodId,
        givenAt: givenAtDate,
        reaction: parsed.data.reaction,
        notes: parsed.data.notes?.trim() || null
      })
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .run();

    const from = (raw.from as string) === 'dashboard' ? 'dashboard' : 'foods';
    throw redirect(303, from === 'dashboard' ? `/child/${childId}` : `/child/${childId}/foods`);
  },

  delete: async ({ request, params, locals }) => {
    requireUser(locals);
    const childId = Number(params.id);
    requireMembership(locals, childId);
    const entryId = parseEntryId(params.entryId);
    loadEntry(entryId, childId);

    db.delete(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .run();

    const data = await request.formData();
    const from = String(data.get('from') ?? '') === 'dashboard' ? 'dashboard' : 'foods';
    throw redirect(303, from === 'dashboard' ? `/child/${childId}` : `/child/${childId}/foods`);
  }
};

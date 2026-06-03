import { error, fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { parseIntParam, requireChildContext } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import { resolveOrInsertFood } from '$lib/server/food-resolution';
import { TEXTURE_VALUES } from '$lib/utils/textures';
import type { Actions, PageServerLoad } from './$types';

const schema = z
  .object({
    foodId: z.coerce.number().int().positive().optional(),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(['ras', 'inconfort', 'reaction']),
    texture: z.union([z.enum(TEXTURE_VALUES), z.literal('')]).optional(),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => !!d.foodId || !!d['customFood.name'], {
    message: 'Choisissez un aliment ou créez-en un.'
  });

async function loadEntry(entryId: number, childId: number) {
  const row = (
    await db
      .select()
      .from(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .limit(1)
  )[0];
  if (!row) throw error(404, 'Entrée introuvable');
  return row;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const { childId } = requireChildContext(locals, params);
  const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");

  const entry = await loadEntry(entryId, childId);

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

  // Drizzle's timestamp_ms mode always materializes givenAt as a Date.
  const givenAt = entry.givenAt as Date;

  const fromRaw = url.searchParams.get('from');
  const from: 'dashboard' | 'detail' | 'foods' =
    fromRaw === 'dashboard' ? 'dashboard' : fromRaw === 'detail' ? 'detail' : 'foods';

  return {
    foods: list,
    entry: {
      id: entry.id,
      foodId: entry.foodId,
      givenAt: givenAt.getTime(),
      reaction: entry.reaction,
      texture: entry.texture ?? null,
      notes: entry.notes
    },
    from
  };
};

function destinationFor(
  from: string,
  childId: number,
  entryId: number,
  kind: 'update' | 'delete'
): string {
  if (from === 'dashboard') return `/child/${childId}`;
  // After delete, the detail page would 404 -- send the user back to the carnet.
  if (from === 'detail' && kind === 'update') return `/child/${childId}/foods/${entryId}`;
  return `/child/${childId}/foods`;
}

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    await loadEntry(entryId, childId);

    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    const resolved = await resolveOrInsertFood({
      foodId: parsed.data.foodId ?? null,
      customName: parsed.data['customFood.name'],
      customCategory: parsed.data['customFood.category'],
      childId
    });
    if (!resolved.ok) {
      return fail(400, {
        error:
          resolved.reason === 'not-found' ? 'Aliment introuvable.' : 'Aucun aliment sélectionné.'
      });
    }
    const { foodId } = resolved;

    const givenAtDate = new Date(parsed.data.givenAt);
    if (Number.isNaN(givenAtDate.getTime())) {
      return fail(400, { error: 'Date invalide.' });
    }

    const textureValue =
      parsed.data.texture === undefined
        ? null
        : parsed.data.texture === ''
          ? null
          : parsed.data.texture;

    await db
      .update(foodEntries)
      .set({
        foodId,
        givenAt: givenAtDate,
        reaction: parsed.data.reaction,
        texture: textureValue,
        notes: parsed.data.notes?.trim() || null,
        updatedAt: new Date()
      })
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)));
    audit({ type: 'food_entry.updated', userId: user.id, childId, entryId });

    const from = String(raw.from ?? '');
    throw localizedRedirect(locals.locale, 303, destinationFor(from, childId, entryId, 'update'));
  },

  delete: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    await loadEntry(entryId, childId);

    await db
      .delete(foodEntries)
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)));
    audit({ type: 'food_entry.deleted', userId: user.id, childId, entryId });

    const data = await request.formData();
    const from = String(data.get('from') ?? '');
    throw localizedRedirect(locals.locale, 303, destinationFor(from, childId, entryId, 'delete'));
  }
};

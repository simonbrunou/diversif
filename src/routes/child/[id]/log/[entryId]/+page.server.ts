import { error, fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { parseIntParam, requireChildContext } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import { resolveOrInsertFood } from '$lib/server/food-resolution';
import { TEXTURE_VALUES } from '$lib/utils/textures';
import { REACTION_VALUES } from '$lib/utils/reaction-values';
import type { SafeUser } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

const schema = z
  .object({
    foodId: z.coerce.number().int().positive().optional(),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(REACTION_VALUES),
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

  // A meal is a group of >=2 food_entries rows sharing a non-null mealId. Load
  // the siblings (childId-scoped, same as loadEntry) so the page can render
  // meal mode. `siblings.length > 1` (not just `entry.mealId != null`) is the
  // actual "is this a meal?" check: removeIngredient nulls the survivor's
  // mealId once a meal shrinks to one row, but belt-and-suspenders here means
  // a stale/partial mealId can never present as a meal of one.
  const siblings = entry.mealId
    ? await db
        .select({
          id: foodEntries.id,
          foodId: foodEntries.foodId,
          foodName: foods.name,
          reaction: foodEntries.reaction
        })
        .from(foodEntries)
        .innerJoin(foods, eq(foods.id, foodEntries.foodId))
        .where(and(eq(foodEntries.mealId, entry.mealId), eq(foodEntries.childId, childId)))
        .orderBy(asc(foodEntries.id))
    : [];
  const meal = siblings.length > 1 ? { mealId: entry.mealId as string, members: siblings } : null;

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
    from,
    meal
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

// Shared givenAt/texture/notes write to every sibling of a meal, plus a
// dirty-only, optimistically-guarded per-ingredient reaction write. Extracted
// out of the `update` action (rather than inlined) so `update`'s branch +
// validation + shared write + per-ingredient loop don't all live in one
// function and trip the repo's fallow cognitive-complexity gate.
async function updateMeal(opts: {
  raw: Record<string, FormDataEntryValue>;
  mealId: string;
  entryId: number;
  childId: number;
  user: SafeUser;
  locals: App.Locals;
}) {
  const { raw, mealId, entryId, childId, user, locals } = opts;

  const givenAtDate = new Date(String(raw.givenAt));
  if (Number.isNaN(givenAtDate.getTime())) return fail(400, { error: 'Date invalide.' });

  // Validate texture against the enum — an unchecked value hits the DB CHECK
  // and 500s instead of returning a graceful 400 (the single-entry path uses
  // a zod enum; mirror it here since the meal-mode payload is hand-validated).
  const rawTexture = raw.texture === '' || raw.texture == null ? null : String(raw.texture);
  if (rawTexture !== null && !TEXTURE_VALUES.includes(rawTexture as never)) {
    return fail(400, { error: 'Texture invalide.' });
  }
  const texture = rawTexture as (typeof TEXTURE_VALUES)[number] | null;
  const notes = String(raw.notes ?? '').trim() || null;
  // Mirror the single-entry path's zod `z.string().max(2000)`: this meal
  // payload is hand-validated (no schema), so without this check a crafted
  // request bypasses the client `maxlength` and writes unbounded text to
  // every sibling.
  if (notes && notes.length > 2000) return fail(400, { error: 'Note trop longue.' });

  const members = await db
    .select({ id: foodEntries.id, reaction: foodEntries.reaction })
    .from(foodEntries)
    .where(and(eq(foodEntries.mealId, mealId), eq(foodEntries.childId, childId)));

  db.transaction((tx) => {
    // Shared fields to every sibling.
    tx.update(foodEntries)
      .set({ givenAt: givenAtDate, texture, notes, updatedAt: new Date() })
      .where(and(eq(foodEntries.mealId, mealId), eq(foodEntries.childId, childId)))
      .run();

    // Dirty-only, optimistically-guarded per-ingredient reaction write: only
    // issue an UPDATE when the submitted value differs from what the form had
    // loaded, and guard the WHERE on that loaded value. If a symptom promoted
    // this row's reaction between load and submit, the guarded WHERE no-ops
    // instead of clobbering the promotion with a stale value.
    for (const mem of members) {
      const submitted = raw[`reaction.${mem.id}`];
      const loaded = String(raw[`reactionLoaded.${mem.id}`] ?? mem.reaction);
      if (
        typeof submitted === 'string' &&
        submitted !== loaded &&
        REACTION_VALUES.includes(submitted as never)
      ) {
        tx.update(foodEntries)
          .set({ reaction: submitted as (typeof REACTION_VALUES)[number], updatedAt: new Date() })
          .where(
            and(
              eq(foodEntries.id, mem.id),
              eq(foodEntries.childId, childId),
              eq(foodEntries.reaction, loaded as never)
            )
          )
          .run();
      }
    }
  });

  audit({ type: 'food_entry.updated', userId: user.id, childId, entryId });
  throw localizedRedirect(
    locals.locale,
    303,
    destinationFor(String(raw.from ?? ''), childId, entryId, 'update')
  );
}

export const actions: Actions = {
  update: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    const entry = await loadEntry(entryId, childId);

    const raw = Object.fromEntries(await request.formData());

    // A meal member gets the shared+per-ingredient write; a standalone entry
    // falls through to the single-entry path below (unchanged).
    if (entry.mealId) {
      return updateMeal({ raw, mealId: entry.mealId, entryId, childId, user, locals });
    }

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
  },

  deleteMeal: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    const entry = await loadEntry(entryId, childId);
    if (!entry.mealId) return fail(400, { error: 'Repas introuvable.' });

    await db
      .delete(foodEntries)
      .where(and(eq(foodEntries.mealId, entry.mealId), eq(foodEntries.childId, childId)));
    audit({ type: 'food_entry.deleted', userId: user.id, childId, entryId });

    const data = await request.formData();
    const from = String(data.get('from') ?? '');
    throw localizedRedirect(locals.locale, 303, destinationFor(from, childId, entryId, 'delete'));
  },

  removeIngredient: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    const fd = await request.formData();
    const removeId = Number(fd.get('removeId'));
    const entry = await loadEntry(entryId, childId);
    if (!entry.mealId || !Number.isInteger(removeId)) {
      return fail(400, { error: 'Requête invalide.' });
    }

    // db.transaction returns the callback's value SYNCHRONOUSLY under
    // bun:sqlite — landOn below relies on that (no await inside the callback).
    const landOn = db.transaction((tx) => {
      tx.delete(foodEntries)
        .where(
          and(
            eq(foodEntries.id, removeId),
            eq(foodEntries.childId, childId),
            eq(foodEntries.mealId, entry.mealId!)
          )
        )
        .run();

      const rest = tx
        .select({ id: foodEntries.id })
        .from(foodEntries)
        .where(and(eq(foodEntries.mealId, entry.mealId!), eq(foodEntries.childId, childId)))
        .orderBy(asc(foodEntries.id))
        .all();

      if (rest.length === 1) {
        tx.update(foodEntries)
          .set({ mealId: null, updatedAt: new Date() })
          .where(eq(foodEntries.id, rest[0].id))
          .run();
      }

      // Redirect target must be a SURVIVING entry — never `removeId`/`entryId`,
      // which is usually the anchor the editor opened on (deleting it then
      // redirecting to /log/{entryId} 404s). rest[0] is the lowest surviving id.
      return rest[0]?.id ?? null;
    });

    audit({ type: 'food_entry.updated', userId: user.id, childId, entryId });
    throw localizedRedirect(
      locals.locale,
      303,
      landOn === null ? `/child/${childId}/foods` : `/child/${childId}/log/${landOn}`
    );
  }
};

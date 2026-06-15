import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import {
  listSymptomsByEntry,
  insertSymptom,
  deleteSymptomById,
  countNthExposition
} from '$lib/server/db/symptoms';
import { parseIntParam, requireChildContext } from '$lib/server/guards';
import { SYMPTOM_LABELS, type SymptomLabel } from '$lib/content/symptoms';
import { audit } from '$lib/server/audit';
import { formatDate, formatTime } from '$lib/utils/dates';
import type { Actions, PageServerLoad } from './$types';

async function loadEntryForChild(entryId: number, childId: number) {
  const row = (
    await db
      .select({
        id: foodEntries.id,
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt,
        reaction: foodEntries.reaction,
        texture: foodEntries.texture,
        foodName: foods.name
      })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .limit(1)
  )[0];
  if (!row) throw error(404, 'Food entry not found');
  return row;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const { childId } = requireChildContext(locals, params);
  const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");

  const row = await loadEntryForChild(entryId, childId);

  const intlLocale = (locals.locale ?? 'fr') === 'fr' ? 'fr-FR' : 'en-GB';
  const sList = (await listSymptomsByEntry(entryId, childId)).map((s) => ({
    id: s.id,
    label: s.label,
    observedAt: formatTime(s.observedAt, intlLocale),
    note: s.note
  }));
  const nth = await countNthExposition(entryId, childId);

  return {
    childId,
    entryId,
    food: row.foodName,
    isRas: row.reaction === 'ras',
    texture: row.texture ?? null,
    nth,
    date: formatDate(row.givenAt, intlLocale, { style: 'short' }),
    time: formatTime(row.givenAt, intlLocale),
    symptoms: sList
  };
};

const addSchema = z.object({
  label: z.enum(SYMPTOM_LABELS as unknown as [SymptomLabel, ...SymptomLabel[]]),
  note: z.string().max(280).optional().default(''),
  observedAt: z.string().regex(/^\d{2}:\d{2}$/)
});

export const actions: Actions = {
  addSymptom: async ({ locals, params, request }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");

    const raw = Object.fromEntries(await request.formData());
    const parsed = addSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, { error: 'invalid-input' });
    }
    const entry = await loadEntryForChild(entryId, childId);

    const [hh, mm] = parsed.data.observedAt.split(':').map(Number);
    const observedAt = new Date();
    observedAt.setHours(hh, mm, 0, 0);

    const result = await insertSymptom({
      foodEntryId: entryId,
      childId,
      observedAt,
      label: parsed.data.label,
      note: parsed.data.note.trim() || null,
      createdBy: user.id,
      currentReaction: entry.reaction
    });

    audit({
      type: 'symptom.added',
      userId: user.id,
      childId,
      entryId,
      label: parsed.data.label
    });

    if (result.promotedTo) {
      audit({
        type: 'food_entry.reaction_promoted',
        userId: user.id,
        childId,
        entryId,
        from: 'ras',
        to: result.promotedTo,
        triggeredBy: result.symptomId
      });
    }

    return { success: true };
  },

  deleteSymptom: async ({ locals, params, request }) => {
    const { user, childId } = requireChildContext(locals, params);
    const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");
    await loadEntryForChild(entryId, childId);

    const raw = Object.fromEntries(await request.formData());
    const symptomId = Number(raw.symptomId);
    if (!Number.isInteger(symptomId) || symptomId <= 0) {
      return fail(400, { error: 'invalid-input' });
    }

    const deleted = await deleteSymptomById({ symptomId, foodEntryId: entryId, childId });
    if (!deleted) {
      return fail(404, { error: 'not-found' });
    }

    audit({
      type: 'symptom.deleted',
      userId: user.id,
      childId,
      entryId,
      symptomId
    });

    return { success: true };
  }
};

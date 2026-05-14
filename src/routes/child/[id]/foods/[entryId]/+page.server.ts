import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { listSymptomsByEntry, insertSymptom, countNthExposition } from '$lib/server/db/symptoms';
import { parseChildIdParam, requireMembership } from '$lib/server/guards';
import { SYMPTOM_LABELS, type SymptomLabel } from '$lib/content/symptoms';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

function parseEntryIdParam(raw: string | undefined): number {
  const n = raw === undefined ? NaN : Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw error(404, 'Food entry not found');
  return n;
}

async function loadEntryForChild(entryId: number, childId: number) {
  const row = (
    await db
      .select({
        id: foodEntries.id,
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt,
        reaction: foodEntries.reaction,
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
  const childId = parseChildIdParam(params);
  const entryId = parseEntryIdParam(params.entryId);
  const { user } = requireMembership(locals, childId);
  void user;

  const row = await loadEntryForChild(entryId, childId);

  const locale = (locals.locale ?? 'fr') as 'fr' | 'en';
  const sList = (await listSymptomsByEntry(entryId)).map((s) => ({
    id: s.id,
    label: s.label,
    observedAt: formatTime(s.observedAt, locale),
    note: s.note
  }));
  const nth = await countNthExposition(entryId);

  return {
    childId,
    entryId,
    food: row.foodName,
    isRas: row.reaction === 'ras',
    nth,
    date: formatDate(row.givenAt, locale),
    time: formatTime(row.givenAt, locale),
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
    const childId = parseChildIdParam(params);
    const entryId = parseEntryIdParam(params.entryId);
    const { user } = requireMembership(locals, childId);

    const raw = Object.fromEntries(await request.formData());
    const parsed = addSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, { error: 'invalid-input' });
    }
    await loadEntryForChild(entryId, childId);

    const [hh, mm] = parsed.data.observedAt.split(':').map(Number);
    const observedAt = new Date();
    observedAt.setHours(hh, mm, 0, 0);

    await insertSymptom({
      foodEntryId: entryId,
      childId,
      observedAt,
      label: parsed.data.label,
      note: parsed.data.note.trim() || null,
      createdBy: user.id
    });

    audit({
      type: 'symptom.added',
      userId: user.id,
      childId,
      entryId,
      label: parsed.data.label
    });
    return { success: true };
  }
};

function formatDate(d: Date, locale: 'fr' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long'
  }).format(d);
}

function formatTime(d: Date, locale: 'fr' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

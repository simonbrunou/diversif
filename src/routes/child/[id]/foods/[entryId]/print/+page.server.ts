import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, foodEntries, foods } from '$lib/server/db/schema';
import { listSymptomsByEntry } from '$lib/server/db/symptoms';
import { requireChildContext } from '$lib/server/guards';
import { ageInMonths } from '$lib/utils/age';
import * as m from '$lib/paraglide/messages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const { childId } = requireChildContext(locals, params);
  const entryId = Number(params.entryId);

  const row = (
    await db
      .select({
        childName: children.name,
        birthDate: children.birthDate,
        foodName: foods.name,
        givenAt: foodEntries.givenAt,
        reaction: foodEntries.reaction
      })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .innerJoin(children, eq(children.id, foodEntries.childId))
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .limit(1)
  )[0];
  // error() renders through +error.svelte, which shows the message verbatim —
  // resolve it here (paraglide's per-request locale context) same as join/[code].
  if (!row) throw error(404, m.errorsFoodEntryNotFound());

  const sList = await listSymptomsByEntry(entryId, childId);
  const locale = (locals.locale ?? 'fr') as 'fr' | 'en';
  const dtf = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return {
    childName: row.childName,
    months: ageInMonths(row.birthDate),
    foodName: row.foodName,
    reaction: row.reaction,
    givenAt: dtf.format(row.givenAt),
    symptoms: sList.map((s) => ({
      label: s.label,
      observedAt: dtf.format(s.observedAt),
      note: s.note
    })),
    generatedAt: dtf.format(new Date())
  };
};

import { error, fail } from '@sveltejs/kit';
import { localizedRedirect } from '#lib/server/redirect.js';
import { parseIntParam, requireChildContext } from '#lib/server/guards.js';
import { loadVisibleFoodsForChild } from '#lib/server/food-resolution.js';
import {
  deleteEntry,
  deleteMeal,
  editRepas,
  readRepas,
  removeIngredient,
  type RepasRefusal
} from '#lib/server/repas/index.js';
import * as m from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

// error() renders through +error.svelte, which shows the message verbatim —
// resolve it here (paraglide's per-request locale context) same as join/[code].
function entryNotFound(): never {
  error(404, m.errorsFoodEntryNotFound());
}

function refused(refusal: RepasRefusal) {
  if (refusal.status === 404) entryNotFound();
  return fail(refusal.status, { errorKey: refusal.errorKey });
}

function entryContext({ locals, params }: RequestEvent) {
  const ctx = requireChildContext(locals, params);
  return { ctx, entryId: parseIntParam(params.entryId, "Identifiant d'entrée") };
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const { childId } = requireChildContext(locals, params);
  const entryId = parseIntParam(params.entryId, "Identifiant d'entrée");

  const repas = readRepas({ childId }, entryId) ?? entryNotFound();
  const list = await loadVisibleFoodsForChild(childId);

  const fromRaw = url.searchParams.get('from');
  const from: 'dashboard' | 'detail' | 'foods' =
    fromRaw === 'dashboard' ? 'dashboard' : fromRaw === 'detail' ? 'detail' : 'foods';

  return {
    foods: list,
    entry: { ...repas.entry, givenAt: repas.entry.givenAt.getTime() },
    from,
    meal: repas.meal
  };
};

function destinationFor(
  form: FormData,
  childId: number,
  entryId: number,
  kind: 'update' | 'delete'
): string {
  const from = form.get('from');
  if (from === 'dashboard') return `/child/${childId}`;
  // After delete, the detail page would 404 -- send the user back to the carnet.
  if (from === 'detail' && kind === 'update') return `/child/${childId}/foods/${entryId}`;
  return `/child/${childId}/foods`;
}

export const actions: Actions = {
  update: async (event) => {
    const { ctx, entryId } = entryContext(event);
    const form = await event.request.formData();
    const edited = editRepas(ctx, entryId, form);
    if (!edited.ok) return refused(edited);
    const to = destinationFor(form, ctx.childId, entryId, 'update');
    throw localizedRedirect(event.locals.locale, 303, to);
  },

  delete: async (event) => {
    const { ctx, entryId } = entryContext(event);
    const form = await event.request.formData();
    const deleted = deleteEntry(ctx, entryId);
    if (!deleted.ok) return refused(deleted);
    const to = destinationFor(form, ctx.childId, entryId, 'delete');
    throw localizedRedirect(event.locals.locale, 303, to);
  },

  deleteMeal: async (event) => {
    const { ctx, entryId } = entryContext(event);
    const form = await event.request.formData();
    const deleted = deleteMeal(ctx, entryId);
    if (!deleted.ok) return refused(deleted);
    const to = destinationFor(form, ctx.childId, entryId, 'delete');
    throw localizedRedirect(event.locals.locale, 303, to);
  },

  removeIngredient: async (event) => {
    const { ctx, entryId } = entryContext(event);
    const removed = removeIngredient(ctx, entryId, await event.request.formData());
    if (!removed.ok) return refused(removed);
    const to = `/child/${ctx.childId}/log/${removed.landOn}`;
    throw localizedRedirect(event.locals.locale, 303, to);
  }
};

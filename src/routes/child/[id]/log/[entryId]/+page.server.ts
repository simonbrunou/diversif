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
  type RepasContext,
  type RepasRefusal
} from '#lib/server/repas/index.js';
import * as m from '#lib/paraglide/messages.js';
import type { Action, Actions, PageServerLoad, RequestEvent } from './$types';

// error() renders through +error.svelte, which shows the message verbatim —
// resolve it here (paraglide's per-request locale context) same as join/[code].
function entryNotFound(): never {
  error(404, m.errorsFoodEntryNotFound());
}

function refused(refusal: RepasRefusal) {
  if (refusal.status === 404) entryNotFound();
  return fail(refusal.status, { errorKey: refusal.errorKey });
}

function entryContext({ locals, params }: Pick<RequestEvent, 'locals' | 'params'>) {
  const ctx = requireChildContext(locals, params);
  return { ctx, entryId: parseIntParam(params.entryId, "Identifiant d'entrée") };
}

export const load: PageServerLoad = async (event) => {
  const { ctx, entryId } = entryContext(event);

  const repas = readRepas(ctx, entryId) ?? entryNotFound();
  const list = await loadVisibleFoodsForChild(ctx.childId);

  const fromRaw = event.url.searchParams.get('from');
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

// An action that writes through the repas module, then goes back where the
// editor was opened from (the form's `from`).
function writeThenLeave(
  kind: 'update' | 'delete',
  write: (ctx: RepasContext, entryId: number, form: FormData) => RepasRefusal | { ok: true }
): Action {
  return async (event) => {
    const { ctx, entryId } = entryContext(event);
    const form = await event.request.formData();
    const written = write(ctx, entryId, form);
    if (!written.ok) return refused(written);
    const to = destinationFor(form, ctx.childId, entryId, kind);
    throw localizedRedirect(event.locals.locale, 303, to);
  };
}

export const actions: Actions = {
  update: writeThenLeave('update', editRepas),
  delete: writeThenLeave('delete', deleteEntry),
  deleteMeal: writeThenLeave('delete', deleteMeal),

  // Lands on a surviving entry of the meal, not where the editor came from.
  removeIngredient: async (event) => {
    const { ctx, entryId } = entryContext(event);
    const removed = removeIngredient(ctx, entryId, await event.request.formData());
    if (!removed.ok) return refused(removed);
    const to = `/child/${ctx.childId}/log/${removed.landOn}`;
    throw localizedRedirect(event.locals.locale, 303, to);
  }
};

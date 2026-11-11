import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '#lib/server/redirect.js';
import { asc, eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { foodEntries, preparedMeals } from '#lib/server/db/schema.js';
import { requireChildContext, requireUser } from '#lib/server/guards.js';
import { loadVisibleFoodsForChild } from '#lib/server/food-resolution.js';
import { logRepas, queuedByOther } from '#lib/server/repas/index.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const { childId } = requireChildContext(locals, params);

  const list = await loadVisibleFoodsForChild(childId);

  // Distinct foodIds already logged for this child, so the picker can badge
  // a "never tried" hint when several brand-new foods are selected together.
  const introduced = await db
    .selectDistinct({ foodId: foodEntries.foodId })
    .from(foodEntries)
    .where(eq(foodEntries.childId, childId));

  const savedPreparedMeals = await db
    .select({
      id: preparedMeals.id,
      brand: preparedMeals.brand,
      name: preparedMeals.name,
      foodIds: preparedMeals.ingredientFoodIds,
      lastUsedAt: preparedMeals.lastUsedAt
    })
    .from(preparedMeals)
    .where(eq(preparedMeals.childId, childId))
    .orderBy(asc(preparedMeals.lastUsedAt), asc(preparedMeals.brand), asc(preparedMeals.name));

  return {
    foods: list,
    introducedFoodIds: introduced.map((r) => r.foodId),
    preparedMeals: savedPreparedMeals
  };
};

export const actions: Actions = {
  // The offline-queue replay (src/lib/offline/queue.ts) posts here too.
  default: async ({ request, params, locals }) => {
    // A logged-out replay still gets the /login redirect first: the queue
    // keeps the row for its user's next login (#308).
    const user = requireUser(locals);
    const form = await request.formData();
    // A replay of a row another user queued (#566) is refused before the
    // child and membership checks and the write, so it never meets their
    // 403/404 or the idempotency 409. The queue drops it without a toast.
    if (queuedByOther(form, user.id)) return fail(403, { queuedByOther: true as const });
    const ctx = requireChildContext(locals, params);
    const logged = logRepas(ctx, form);
    if (!logged.ok) return fail(logged.status, { errorKey: logged.errorKey });
    throw localizedRedirect(locals.locale, 303, logged.redirect);
  }
};

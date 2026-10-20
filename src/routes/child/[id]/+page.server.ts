import { fail } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.js';
import { ageInMonths } from '#lib/utils/age.js';
import { loadChildHistory } from '#lib/server/guidance/child-history.js';
import { dismissReminder, loadDismissals } from '#lib/server/guidance/dismissals.js';
import { requireChildContext } from '#lib/server/guards.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  // Same ordering as the layout: redirect guests to /login *before* a
  // malformed id can turn the response into a 404.
  const { user, childId } = requireChildContext(locals, params);
  const { child } = await parent();
  // One instant for the whole page: the age, every window of the history and
  // the dismissal TTLs. Otherwise a request that straddles a month boundary by
  // a few microseconds could compute ageMonths from one Date and the 4-11-month
  // allergen window from another, silently disagreeing.
  const now = Date.now();
  const ageMonths = ageInMonths(child.birthDate, new Date(now));
  const dismissals = await loadDismissals(user.id, childId, now);
  const history = loadChildHistory(db, childId, now);

  return {
    recent: history.recent,
    stats: {
      foodsIntroduced: history.foodsIntroduced,
      weekCount: history.newFoodsThisWeek
    },
    bentoAllergens: history.allergens.statuses,
    streak: history.streak,
    coparentActivity: history.coparentActivity(user.id),
    reminders: history.reminders({ ageMonths, childCreatedAt: child.createdAt, dismissals }),
    // Welcome dialog: only while the child has no entry at all and the parent
    // hasn't closed it. Gated on ageMonths >= 4 so the onboarding (which
    // nudges "log a first food") doesn't fire for an under-4-month baby, who
    // instead sees the "pas encore l'heure" pre-diversification card.
    // Otherwise the modal and that card contradict each other, and the
    // one-shot dialog is spent before it's useful.
    showWelcomeDialog:
      !dismissals.has('welcome-dialog') && history.foodsIntroduced === 0 && ageMonths >= 4,
    ageMonths
  };
};

export const actions: Actions = {
  dismissReminder: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const data = await request.formData();
    const key = data.get('reminderKey');
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
      return fail(400, { errorKey: 'errorsLogInvalidRequest' });
    }
    await dismissReminder(user.id, childId, key);
    return { ok: true };
  }
};

import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { foodEntries, foods, users, children as childrenTable } from '$lib/server/db/schema';
import { desc, eq, sql, and, isNotNull } from 'drizzle-orm';
import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
import { CATEGORIES } from '$lib/utils/categories';
import { ageInMonths } from '$lib/utils/age';
import { computeReminders } from '$lib/server/guidance/reminders';
import {
  loadDiversityMetrics,
  loadDismissals,
  dismissReminder,
  type EnrichedEntry
} from '$lib/server/guidance/queries';
import { requireMembership, requireUser } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type AllergenSummary = {
  introduced: number;
  total: number;
  ras: number;
  inconfort: number;
  reaction: number;
};

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  const user = requireUser(locals);
  const childId = Number(params.id);
  const { child } = await parent();
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const recent = db
    .select({
      id: foodEntries.id,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      notes: foodEntries.notes,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .innerJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(eq(foodEntries.childId, childId))
    .orderBy(desc(foodEntries.givenAt))
    .limit(20)
    .all();

  const distinctFoods =
    db.get<{ count: number }>(
      sql`SELECT COUNT(DISTINCT food_id) as count FROM food_entries WHERE child_id = ${childId}`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  const weekCount =
    db.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM food_entries WHERE child_id = ${childId} AND given_at >= ${sevenDaysAgo.getTime()}`
    )?.count /* v8 ignore next — sqlite COUNT() always returns a row */ ?? 0;

  const allergenRows = db
    .select({
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
    .all();

  const worstByAllergen = new Map<string, 'ras' | 'inconfort' | 'reaction'>();
  for (const r of allergenRows) {
    /* v8 ignore next — query already filters allergenType IS NOT NULL */
    if (!r.allergenType) continue;
    const cur = worstByAllergen.get(r.allergenType);
    const next = r.reaction as 'ras' | 'inconfort' | 'reaction';
    if (!cur) {
      worstByAllergen.set(r.allergenType, next);
    } else {
      const rank = { ras: 0, inconfort: 1, reaction: 2 } as const;
      if (rank[next] > rank[cur]) worstByAllergen.set(r.allergenType, next);
    }
  }

  const summary: AllergenSummary = {
    introduced: worstByAllergen.size,
    total: ALLERGENS.length,
    ras: 0,
    inconfort: 0,
    reaction: 0
  };
  for (const v of worstByAllergen.values()) summary[v] += 1;

  // Diversity metrics
  const diversity = loadDiversityMetrics(childId, CATEGORIES.length - 1); // exclude 'autre'

  // Reminders: full history is required so first-introduction and
  // exposure-count rules (stale-diversity, repeat-exposure) are correct
  // for active children with logs older than 90 days.
  const recentForReminders = db
    .select({
      id: foodEntries.id,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId))
    .orderBy(desc(foodEntries.givenAt))
    .all();

  const entriesNormalized: EnrichedEntry[] = recentForReminders.map((r) => {
    const ts = r.givenAt as unknown;
    return {
      id: r.id,
      foodId: r.foodId,
      foodName: r.foodName,
      category: r.category as EnrichedEntry['category'],
      allergenType: r.allergenType,
      reaction: r.reaction as EnrichedEntry['reaction'],
      givenAt: ts instanceof Date ? ts.getTime() : /* v8 ignore next */ Number(ts)
    };
  });

  const childRow = db
    .select({ createdAt: childrenTable.createdAt })
    .from(childrenTable)
    .where(eq(childrenTable.id, childId))
    .get();
  // Drizzle's timestamp_ms mode always materializes createdAt as Date here.
  /* v8 ignore next 4 */
  const childCreatedAt =
    childRow?.createdAt instanceof Date
      ? childRow.createdAt.getTime()
      : Number(childRow?.createdAt ?? Date.now());

  const dismissals = loadDismissals(user.id, childId);
  const introducedAllergenIds = new Set(
    Array.from(worstByAllergen.keys()).filter((id): id is AllergenId =>
      ALLERGENS.some((a) => a.id === id)
    )
  );

  const reminders = computeReminders({
    childId,
    ageMonths: ageInMonths(child.birthDate),
    childCreatedAt,
    entries: entriesNormalized,
    introducedAllergens: introducedAllergenIds,
    dismissals
  });

  // Welcome dialog: show only if not dismissed and the child has no entries
  // *all-time* — `entriesNormalized` only covers the last 90 days, so basing
  // this on that set would re-trigger onboarding for older children that
  // simply went silent for a quarter.
  const showWelcomeDialog = !dismissals.has('welcome-dialog') && distinctFoods === 0;

  return {
    recent: recent.map((r) => ({
      ...r,
      givenAt:
        r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt)
    })),
    stats: {
      foodsIntroduced: distinctFoods,
      weekCount,
      allergens: summary
    },
    diversity,
    reminders,
    showWelcomeDialog
  };
};

export const actions: Actions = {
  dismissReminder: async ({ request, params, locals }) => {
    const user = requireUser(locals);
    const childId = Number(params.id);
    requireMembership(locals, childId);
    const data = await request.formData();
    const key = data.get('reminderKey');
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
      return fail(400, { error: 'Clé invalide' });
    }
    dismissReminder(user.id, childId, key);
    return { ok: true };
  }
};

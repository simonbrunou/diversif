import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { desc, eq, sql, and, isNotNull } from 'drizzle-orm';
import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
import { CATEGORIES } from '$lib/utils/categories';
import { ageInMonths } from '$lib/utils/age';
import { computeReminders } from '$lib/server/guidance/reminders';
import {
  loadCoparentActivity,
  loadDiversityMetrics,
  loadDismissals,
  loadStreak,
  loadWeeklyRecap,
  dismissReminder,
  type EnrichedEntry
} from '$lib/server/guidance/queries';
import { parseChildIdParam, requireMembership, requireUser } from '$lib/server/guards';
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
  // Same ordering as the layout: redirect guests to /login *before* a
  // malformed id can turn the response into a 404.
  requireUser(locals);
  const childId = parseChildIdParam(params);
  const { user } = requireMembership(locals, childId);
  const { child } = await parent();
  // Pin a single "now" so ageMonths, the reminder windows, and the
  // weekCount cutoff all see the same instant. Otherwise a request that
  // straddles a month boundary by a few microseconds could compute
  // ageMonths from one Date and the 4-11-month allergen window from
  // another, silently disagreeing.
  const nowAtLoad = new Date();
  const sevenDaysAgo = new Date(nowAtLoad.getTime() - SEVEN_DAYS_MS);

  const recent = await db
    .select({
      id: foodEntries.id,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction,
      notes: foodEntries.notes,
      texture: foodEntries.texture,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .leftJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(eq(foodEntries.childId, childId))
    .orderBy(desc(foodEntries.givenAt))
    .limit(20);

  const distinctFoods = Number(
    (
      await db
        .select({ count: sql<number>`count(distinct ${foodEntries.foodId})` })
        .from(foodEntries)
        .where(eq(foodEntries.childId, childId))
        .limit(1)
    )[0]?.count /* v8 ignore next : COUNT() always returns a row */ ?? 0
  );

  const weekCount = Number(
    (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(foodEntries)
        .where(
          and(eq(foodEntries.childId, childId), sql`${foodEntries.givenAt} >= ${sevenDaysAgo}`)
        )
        .limit(1)
    )[0]?.count /* v8 ignore next : COUNT() always returns a row */ ?? 0
  );

  const allergenRows = await db
    .select({
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)));

  const worstByAllergen = new Map<string, 'ras' | 'inconfort' | 'reaction'>();
  for (const r of allergenRows) {
    /* v8 ignore next : query already filters allergenType IS NOT NULL */
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
  const diversity = await loadDiversityMetrics(childId, CATEGORIES.length - 1); // exclude 'autre'
  const streak = await loadStreak(childId);
  const weeklyRecap = await loadWeeklyRecap(childId);
  const coparentActivity = await loadCoparentActivity(childId, user.id);

  // Reminders: full history is required so first-introduction and
  // exposure-count rules (stale-diversity, repeat-exposure) are correct
  // for active children with logs older than 90 days.
  const recentForReminders = await db
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
    .orderBy(desc(foodEntries.givenAt));

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

  // child.createdAt comes from the layout load, avoiding a second SELECT.
  const childCreatedAt = child.createdAt;

  const ageMonths = ageInMonths(child.birthDate, nowAtLoad);

  const dismissals = await loadDismissals(user.id, childId);
  const introducedAllergenIds = new Set(
    Array.from(worstByAllergen.keys()).filter((id): id is AllergenId =>
      ALLERGENS.some((a) => a.id === id)
    )
  );

  const baseReminders = computeReminders({
    childId,
    ageMonths,
    childCreatedAt,
    entries: entriesNormalized,
    introducedAllergens: introducedAllergenIds,
    dismissals,
    now: nowAtLoad.getTime()
  });

  // Observation-window reminder: if there's a non-RAS entry within the last
  // 48 hours, surface a "check the profile" reminder pointing directly to
  // that entry's reaction-detail page. This lets the user quickly review
  // notes and symptoms without hunting through the log.
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const latestNonRasEntry = entriesNormalized.find(
    (e) => e.reaction !== 'ras' && nowAtLoad.getTime() - e.givenAt <= FORTY_EIGHT_HOURS_MS
  );
  const observationKey = latestNonRasEntry ? `observation-window:${latestNonRasEntry.id}` : null;
  const observationReminder =
    latestNonRasEntry && observationKey && !dismissals.has(observationKey)
      ? {
          key: observationKey,
          severity: 'warn' as const,
          title: `Surveiller « ${latestNonRasEntry.foodName} »`,
          body: 'Une réaction a été notée il y a moins de 48 h. Consultez le profil pour noter les symptômes ou ajouter des observations.',
          cta: {
            label: 'Voir le profil',
            href: `/child/${childId}/foods/${latestNonRasEntry.id}`
          },
          dismissable: true
        }
      : null;

  // Prepend the observation reminder (highest priority) then cap total at 4.
  const reminders = (
    observationReminder ? [observationReminder, ...baseReminders] : baseReminders
  ).slice(0, 4);

  // Welcome dialog: show only if not dismissed and the child has no entries
  // *all-time* : `entriesNormalized` only covers the last 90 days, so basing
  // this on that set would re-trigger onboarding for older children that
  // simply went silent for a quarter.
  const showWelcomeDialog = !dismissals.has('welcome-dialog') && distinctFoods === 0;

  return {
    recent: recent.map((r) => ({
      ...r,
      loggedByName: r.loggedByName ?? 'Compte supprimé',
      givenAt:
        r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt)
    })),
    stats: {
      foodsIntroduced: distinctFoods,
      weekCount,
      allergens: summary
    },
    diversity,
    streak,
    weeklyRecap,
    coparentActivity,
    reminders,
    showWelcomeDialog
  };
};

export const actions: Actions = {
  dismissReminder: async ({ request, params, locals }) => {
    requireUser(locals);
    const childId = parseChildIdParam(params);
    const { user } = requireMembership(locals, childId);
    const data = await request.formData();
    const key = data.get('reminderKey');
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
      return fail(400, { error: 'Clé invalide' });
    }
    await dismissReminder(user.id, childId, key);
    return { ok: true };
  }
};

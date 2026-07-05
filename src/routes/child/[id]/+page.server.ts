import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { foodEntries, foods, users } from '$lib/server/db/schema';
import { asc, desc, eq, sql, and, isNotNull } from 'drizzle-orm';
import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
import { CATEGORIES, type CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';
import { REACTION_RANK } from '$lib/utils/reaction-values';
import { ageInMonths } from '$lib/utils/age';
import { toEpochMs } from '$lib/utils/dates';
import { computeReminders, type Reminder } from '$lib/server/guidance/reminders';
import { loadAllergenStatus } from '$lib/server/guidance/allergen-status';
import * as m from '$lib/paraglide/messages';
import {
  loadCoparentActivity,
  loadDiversityMetrics,
  loadDismissals,
  loadStreak,
  loadWeeklyRecap,
  dismissReminder,
  type EnrichedEntry
} from '$lib/server/guidance/queries';
import { requireChildContext } from '$lib/server/guards';
import type { Actions, PageServerLoad } from './$types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type AllergenSummary = {
  introduced: number;
  total: number;
  ras: number;
  inconfort: number;
  reaction: number;
};

// Worst reaction seen per allergen, plus the introduced / per-reaction summary.
function summarizeAllergens(rows: { allergenType: string | null; reaction: string }[]): {
  worstByAllergen: Map<string, 'ras' | 'inconfort' | 'reaction'>;
  summary: AllergenSummary;
} {
  const worstByAllergen = new Map<string, 'ras' | 'inconfort' | 'reaction'>();
  for (const r of rows) {
    /* v8 ignore next : query already filters allergenType IS NOT NULL */
    if (!r.allergenType) continue;
    const cur = worstByAllergen.get(r.allergenType);
    const next = r.reaction as 'ras' | 'inconfort' | 'reaction';
    if (!cur || REACTION_RANK[next] > REACTION_RANK[cur]) {
      worstByAllergen.set(r.allergenType, next);
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
  return { worstByAllergen, summary };
}

// Observation-window reminder: if there's a non-RAS entry within the last
// 48 hours, surface a "check the profile" reminder pointing directly to
// that entry's reaction-detail page. This lets the user quickly review
// notes and symptoms without hunting through the log.
function buildObservationReminder(
  entries: EnrichedEntry[],
  dismissals: Set<string>,
  childId: number,
  nowMs: number
): Reminder | null {
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
  const latest = entries.find(
    (e) => e.reaction !== 'ras' && nowMs - e.givenAt <= FORTY_EIGHT_HOURS_MS
  );
  if (!latest) return null;
  const key = `observation-window:${latest.id}`;
  if (dismissals.has(key)) return null;
  return {
    key,
    severity: 'warn',
    title: m.reminderObservationTitle({ food: latest.foodName }),
    body: m.reminderObservationBody(),
    cta: {
      label: m.reminderCtaSeeProfile(),
      href: `/child/${childId}/foods/${latest.id}`
    },
    dismissable: true
  };
}

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  // Same ordering as the layout: redirect guests to /login *before* a
  // malformed id can turn the response into a 404.
  const { user, childId } = requireChildContext(locals, params);
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
      mealId: foodEntries.mealId,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .leftJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(eq(foodEntries.childId, childId))
    .orderBy(desc(foodEntries.givenAt), asc(foodEntries.id))
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
          and(
            eq(foodEntries.childId, childId),
            sql`${foodEntries.givenAt} >= ${sevenDaysAgo.getTime()}`
          )
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

  const { worstByAllergen, summary } = summarizeAllergens(allergenRows);

  // Per-allergen status (same loader as the Carnet Allergènes segment) so
  // the "Allergènes prioritaires" tile shows real allergen names, not
  // synthetic placeholders.
  const bentoAllergens = await loadAllergenStatus(childId, nowAtLoad);

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

  const entriesNormalized: EnrichedEntry[] = recentForReminders.map((r) => ({
    id: r.id,
    foodId: r.foodId,
    foodName: r.foodName,
    category: r.category as EnrichedEntry['category'],
    allergenType: r.allergenType,
    reaction: r.reaction as EnrichedEntry['reaction'],
    givenAt: toEpochMs(r.givenAt as Date | number | string)
  }));

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

  const observationReminder = buildObservationReminder(
    entriesNormalized,
    dismissals,
    childId,
    nowAtLoad.getTime()
  );

  // Prepend the observation reminder (highest priority) then cap total at 4.
  const reminders = (
    observationReminder ? [observationReminder, ...baseReminders] : baseReminders
  ).slice(0, 4);

  // Welcome dialog: show only if not dismissed and the child has no entries
  // *all-time* : `entriesNormalized` only covers the last 90 days, so basing
  // this on that set would re-trigger onboarding for older children that
  // simply went silent for a quarter.
  //
  // Gate on ageMonths >= 4 so the onboarding (which nudges "log a first food")
  // doesn't fire for an under-4-month baby — who instead sees the "pas encore
  // l'heure" pre-diversification card. Otherwise the modal and that card
  // contradict each other, and the one-shot dialog is spent before it's useful.
  const showWelcomeDialog =
    !dismissals.has('welcome-dialog') && distinctFoods === 0 && ageMonths >= 4;

  return {
    recent: recent.map((r) => ({
      ...r,
      // The food catalog is seeded from a closed CategoryId/ReactionId union,
      // but Drizzle types these columns as the bare `text` SQL types.
      // Narrow at the read boundary so the RecentEntry contract carries
      // through to consumers.
      category: r.category as CategoryId,
      reaction: r.reaction as ReactionId,
      loggedByName: r.loggedByName ?? 'Compte supprimé',
      givenAt: toEpochMs(r.givenAt as Date | number | string)
    })),
    stats: {
      foodsIntroduced: distinctFoods,
      weekCount,
      allergens: summary
    },
    bentoAllergens,
    diversity,
    streak,
    weeklyRecap,
    coparentActivity,
    reminders,
    showWelcomeDialog,
    ageMonths
  };
};

export const actions: Actions = {
  dismissReminder: async ({ request, params, locals }) => {
    const { user, childId } = requireChildContext(locals, params);
    const data = await request.formData();
    const key = data.get('reminderKey');
    if (typeof key !== 'string' || key.length === 0 || key.length > 100) {
      return fail(400, { error: 'Clé invalide' });
    }
    await dismissReminder(user.id, childId, key);
    return { ok: true };
  }
};

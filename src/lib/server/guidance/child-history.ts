import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { foodEntries, foods, users } from '#lib/server/db/schema.js';
import type * as schema from '#lib/server/db/schema.js';
import * as m from '#lib/paraglide/messages.js';
import type { RecentEntry } from '#lib/types.js';
import type { CategoryId } from '#lib/utils/categories.js';
import { toEpochMs } from '#lib/utils/dates.js';
import { REACTION_RANK, type ReactionId } from '#lib/utils/reaction-values.js';
import type { TextureKey } from '#lib/utils/textures.js';
import { allergenHistoryFrom, type AllergenHistory } from './allergen-history';
import { computeReminders, type Reminder, type ReminderContext } from './reminders';

/** One food_entries row of one child, with its food and the account that logged it. */
export type HistoryEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  allergenType: string | null;
  reaction: ReactionId;
  givenAt: number;
  texture: TextureKey | null;
  mealId: string | null;
  /** Null once the account that logged the entry is deleted. */
  loggedBy: number | null;
  loggedByName: string | null;
};

/** One food the child has been given, across all its entries. */
export type FoodHistory = {
  foodId: number;
  foodName: string;
  category: CategoryId;
  allergenType: string | null;
  count: number;
  worst: ReactionId;
  firstAt: number;
  lastAt: number;
};

/** Consecutive logging days: the current run and the longest one ever. */
type StreakStats = { current: number; record: number };

/** An entry another member of the carnet logged, for the « your co-parent has been busy » card. */
export type CoparentEntry = {
  id: number;
  foodName: string;
  category: CategoryId;
  reaction: ReactionId;
  givenAt: number;
  loggedByName: string;
  mealId: string | null;
};

/** Everything Aujourd'hui shows about one child, derived from one read of their entries. */
export type ChildHistory = {
  /** The 20 latest entries, newest first, for the feed. */
  readonly recent: RecentEntry[];
  /** Distinct foods ever logged: the « aliments découverts » tile. */
  readonly foodsIntroduced: number;
  /** Foods whose first entry falls in the last 7 days. */
  readonly newFoodsThisWeek: number;
  readonly streak: StreakStats;
  /** The allergen history (#427), built from the same rows. */
  readonly allergens: AllergenHistory;
  /**
   * Foods logged at most twice and never with symptoms, the longest unseen
   * first: worth offering again. The Carnet's « à reproposer » filter lists
   * them all; the repeat-exposure reminder narrows them further. A food
   * associated with discomfort is never re-offered without medical advice.
   */
  readonly repeatCandidates: readonly FoodHistory[];
  /**
   * This week's 5 latest entries logged by another member, newest first.
   * Empty for a solo carnet. A deleted account's entries are left out.
   */
  coparentActivity(viewerId: number): CoparentEntry[];
  /**
   * The cards Aujourd'hui shows, in display order, 4 at most: the observation
   * window first, then important, warn and info cards. Dismissed keys are
   * left out; `context.dismissals` must already be expired by their TTL.
   */
  reminders(context: ReminderContext): Reminder[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const RECENT_FEED_SIZE = 20;
const COPARENT_ACTIVITY_SIZE = 5;
const REPEAT_CANDIDATE_MAX_COUNT = 2;

function isRepeatCandidate(food: FoodHistory): boolean {
  return food.count <= REPEAT_CANDIDATE_MAX_COUNT && food.worst === 'ras';
}

// Newest first. Entries of one meal share their instant, so the id keeps them
// in a stable order and adjacent for groupByMeal.
const newestFirst = (a: HistoryEntry, b: HistoryEntry) => b.givenAt - a.givenAt || a.id - b.id;

function toRecentEntry(e: HistoryEntry): RecentEntry {
  return {
    id: e.id,
    foodId: e.foodId,
    foodName: e.foodName,
    category: e.category,
    reaction: e.reaction,
    givenAt: e.givenAt,
    texture: e.texture,
    mealId: e.mealId,
    loggedByName: e.loggedByName ?? m.entryLoggedByDeletedAccount()
  };
}

function buildCoparentActivity(
  newestFirstEntries: readonly HistoryEntry[],
  viewerId: number,
  now: number
): CoparentEntry[] {
  const out: CoparentEntry[] = [];
  for (const e of newestFirstEntries) {
    if (e.givenAt < now - WEEK_MS || out.length === COPARENT_ACTIVITY_SIZE) break;
    if (e.loggedBy === viewerId || e.loggedByName === null) continue;
    out.push({
      id: e.id,
      foodName: e.foodName,
      category: e.category,
      reaction: e.reaction,
      givenAt: e.givenAt,
      loggedByName: e.loggedByName,
      mealId: e.mealId
    });
  }
  return out;
}

function seedFood(e: HistoryEntry): FoodHistory {
  return {
    foodId: e.foodId,
    foodName: e.foodName,
    category: e.category,
    allergenType: e.allergenType,
    count: 1,
    worst: e.reaction,
    firstAt: e.givenAt,
    lastAt: e.givenAt
  };
}

function mergeFood(food: FoodHistory, e: HistoryEntry): void {
  food.count += 1;
  if (REACTION_RANK[e.reaction] > REACTION_RANK[food.worst]) food.worst = e.reaction;
  food.firstAt = Math.min(food.firstAt, e.givenAt);
  food.lastAt = Math.max(food.lastAt, e.givenAt);
}

function buildFoods(entries: readonly HistoryEntry[]): FoodHistory[] {
  const byFood = new Map<number, FoodHistory>();
  for (const e of entries) {
    const food = byFood.get(e.foodId);
    if (food) mergeFood(food, e);
    else byFood.set(e.foodId, seedFood(e));
  }
  return [...byFood.values()];
}

// Longest run of consecutive days. `days` is distinct and descending, so a run
// breaks the moment the gap to the next day is not exactly 1.
function longestRun(days: readonly number[]): number {
  let record = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    run = days[i] === days[i - 1] - 1 ? run + 1 : 1;
    if (run > record) record = run;
  }
  return record;
}

// The run ending today, or yesterday when nothing is logged today yet.
function currentRun(days: readonly number[], today: number): number {
  let cursor = days[0] === today ? today : today - 1;
  let current = 0;
  for (const day of days) {
    if (day !== cursor) break;
    current += 1;
    cursor -= 1;
  }
  return current;
}

// We bucket by UTC day on purpose. Most parents are within UTC±2 (Europe),
// and a UTC-day boundary differs from local-day by at most ~2 hours : well
// outside the normal awake window for logging baby meals (basically nobody
// logs lunch at 02:00 local). The cost of UTC-bucketing is a theoretical
// off-by-one for someone logging right around midnight in a far-east
// timezone; the benefit is a stable computation that doesn't depend on the
// server's TZ env. If we ever start serving users far from Europe, switch to
// a localized bucketing here.
function buildStreak(entries: readonly HistoryEntry[], now: number): StreakStats {
  const days = [...new Set(entries.map((e) => Math.floor(e.givenAt / DAY_MS)))].sort(
    (a, b) => b - a
  );
  if (days.length === 0) return { current: 0, record: 0 };
  return { current: currentRun(days, Math.floor(now / DAY_MS)), record: longestRun(days) };
}

/**
 * Builds the history from rows already in hand, in any order: loadChildHistory's
 * read, or test fixtures. `now` (epoch ms) anchors every window, so all views
 * agree on one instant.
 */
export function childHistoryFrom(
  childId: number,
  entries: readonly HistoryEntry[],
  now: number
): ChildHistory {
  const sorted = [...entries].sort(newestFirst);
  const foods = buildFoods(sorted);
  const allergens = allergenHistoryFrom(sorted, now);
  const repeatCandidates = foods.filter(isRepeatCandidate).sort((a, b) => a.lastAt - b.lastAt);
  return {
    recent: sorted.slice(0, RECENT_FEED_SIZE).map(toRecentEntry),
    foodsIntroduced: foods.length,
    newFoodsThisWeek: foods.filter((f) => f.firstAt >= now - WEEK_MS).length,
    streak: buildStreak(sorted, now),
    allergens,
    repeatCandidates,
    coparentActivity: (viewerId) => buildCoparentActivity(sorted, viewerId, now),
    reminders: (context) =>
      computeReminders({
        ...context,
        childId,
        now,
        entries: sorted,
        foods,
        repeatCandidates,
        allergens
      })
  };
}

/**
 * Reads the child's whole history in one query, unbounded: the first
 * introductions, the repeat candidates and the allergen history all need every
 * entry, however old. One child's history is a few thousand rows at most.
 */
export function loadChildHistory(
  db: BunSQLiteDatabase<typeof schema>,
  childId: number,
  now: number = Date.now()
): ChildHistory {
  const rows = db
    .select({
      id: foodEntries.id,
      foodId: foods.id,
      foodName: foods.name,
      category: foods.category,
      allergenType: foods.allergenType,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt,
      texture: foodEntries.texture,
      mealId: foodEntries.mealId,
      loggedBy: foodEntries.loggedBy,
      loggedByName: users.displayName
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .leftJoin(users, eq(users.id, foodEntries.loggedBy))
    .where(eq(foodEntries.childId, childId))
    .all();
  return childHistoryFrom(
    childId,
    rows.map((r) => ({
      ...r,
      // The catalog is seeded from the closed CategoryId union, but Drizzle
      // types the column as bare text.
      category: r.category as CategoryId,
      givenAt: toEpochMs(r.givenAt as Date | number | string)
    })),
    now
  );
}

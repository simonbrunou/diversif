import { and, eq, isNotNull } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { foodEntries, foods } from '#lib/server/db/schema.js';
import type * as schema from '#lib/server/db/schema.js';
import { toEpochMs } from '#lib/utils/dates.js';
import { parisDateParts } from '#lib/utils/paris-date.js';
import { REACTION_RANK, type ReactionId } from '#lib/utils/reaction-values.js';
import {
  ALLERGENS,
  ALLERGEN_MAINTAIN_DAYS,
  PRIORITY_INTRODUCTION_ALLERGENS,
  getAllergenLabel,
  type AllergenId
} from '#lib/utils/allergens.js';

// Both the bare db handle and a transaction handle: the log action reads the
// history before and after its insert inside one synchronous transaction.
type Executor =
  | BunSQLiteDatabase<typeof schema>
  | SQLiteTransaction<'sync', void, typeof schema, ExtractTablesWithRelations<typeof schema>>;

/** One allergen-tagged food_entries row, as the history reads it. */
export type AllergenEntry = {
  entryId: number;
  allergenType: string | null;
  category: string;
  reaction: ReactionId;
  givenAt: number;
};

export type MaintainCandidate = {
  id: AllergenId;
  /** Epoch ms of the last reliable exposure. */
  lastAt: number;
  daysSince: number;
  /** daysSince has reached ALLERGEN_MAINTAIN_DAYS. */
  overdue: boolean;
};

/** One of the 12 tracked allergens, as the Aujourd'hui tile and the Carnet show it. */
export type AllergenItem = {
  id: string;
  label: string;
  triedCount: number;
  lastTried: string | null;
  /** Days since the most recent log. Null only when the allergen has never been logged ('todo'). Consumed by the 'fading' caption; populated for other states for symmetry but not surfaced. */
  daysSinceLastTried: number | null;
  state: 'cleared' | 'todo' | 'inconfort' | 'reaction' | 'fading';
  /**
   * `food_entries.id` of the entry that produced this allergen's worst
   * reaction — `reaction` outranks `inconfort`, most recent wins a tie. Null
   * for every other state. Lets the dashboard link a 'réaction' pill straight
   * at the entry page that carries the reassurance copy, instead of dumping
   * the parent on the allergen segment index to go hunting.
   */
  worstEntryId: number | null;
};

/** One of the 12 tracked allergens, as the Bilan prints it for the pediatrician. */
export type AllergenBilanRow = {
  id: string;
  label: string;
  isPriority: boolean;
  status: 'introduced' | 'untested';
  worst: ReactionId | null;
  exposures: number;
  firstGivenAt: number | null;
  lastGivenAt: number | null;
};

/**
 * Everything diversif tells a parent about one child's allergens, answered from
 * a single read of their allergen-tagged entries. The rule deciding which
 * entries count is private to this module: an entry counts when the food is a
 * reliable exposure (allergen-tagged, not a fat), or when it carried symptoms,
 * whatever the food.
 */
export type AllergenHistory = {
  /** At least one counted entry. A blocked allergen is introduced, so it is never "still to introduce". */
  isIntroduced(id: string): boolean;
  /**
   * Any entry with inconfort or réaction, a fat included. A blocked allergen is
   * never re-proposed: no maintain nudge, no menu card, no suggestion (#373).
   */
  isBlocked(id: string): boolean;
  /**
   * The milestone rule: at least one reliable exposure logged without symptoms.
   * Narrower than isIntroduced on purpose, since the milestones say "proposé
   * sans symptôme". Says nothing about later symptoms: check isBlocked too.
   */
  isTolerated(id: string): boolean;
  /**
   * Tolerated, never-blocked priority allergens, the most days without a
   * reliable exposure first, ties in PRIORITY_INTRODUCTION_ALLERGENS order. The one
   * maintenance policy: reminders nudge the overdue head, the menu offers the
   * first entry it can serve, the tile marks overdue ones 'fading'.
   */
  readonly maintainQueue: readonly MaintainCandidate[];
  /** All 12 tracked allergens, in ALLERGENS order, for the Aujourd'hui tile and the Carnet. */
  readonly statuses: AllergenItem[];
  /** All 12 tracked allergens, priority first then by label, for the Bilan. */
  readonly bilanRows: AllergenBilanRow[];
  /**
   * Whether logging this catalog food would count as an exposure to its
   * allergen. False for an allergenic fat: its tag only serves blocking.
   */
  isExposureFood(food: { allergenType: string | null; category: string }): boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

// Fat products keep their allergen tag so a reaction still blocks the
// allergen, but their low, variable protein content makes them unreliable as
// an introduction or maintenance exposure.
const FAT_CATEGORY = 'matieres_grasses';

function isReliableExposure(food: { allergenType: string | null; category: string }): boolean {
  return food.allergenType != null && food.category !== FAT_CATEGORY;
}

type Facts = {
  tried: number;
  firstAt: number;
  lastAt: number;
  tolerated: boolean;
  worst: ReactionId;
  /** Entry behind `worst`; null while every counted entry is 'ras'. */
  worstEntryId: number | null;
  worstAt: number;
};

// The exposure rule: an entry counts toward an allergen's history when it is a
// reliable exposure, or when it carried symptoms whatever the food. Symptoms
// on a fat still count, so the allergen reads as introduced and blocked.
function counts(e: AllergenEntry): e is AllergenEntry & { allergenType: string } {
  return e.allergenType != null && (isReliableExposure(e) || e.reaction !== 'ras');
}

const isBlocking = (reaction: ReactionId) => reaction !== 'ras';

function seedFacts(e: AllergenEntry): Facts {
  const blocking = isBlocking(e.reaction);
  return {
    tried: 1,
    firstAt: e.givenAt,
    lastAt: e.givenAt,
    tolerated: !blocking,
    worst: e.reaction,
    worstEntryId: blocking ? e.entryId : null,
    worstAt: e.givenAt
  };
}

// Worst reaction wins; between two entries of the same blocking severity, the
// most recent one does, so the pill links to the latest occurrence.
function mergeFacts(facts: Facts, e: AllergenEntry): Facts {
  const rank = REACTION_RANK[e.reaction];
  const worstRank = REACTION_RANK[facts.worst];
  const beatsWorst =
    rank > worstRank || (isBlocking(e.reaction) && rank === worstRank && e.givenAt > facts.worstAt);
  return {
    tried: facts.tried + 1,
    firstAt: Math.min(facts.firstAt, e.givenAt),
    lastAt: Math.max(facts.lastAt, e.givenAt),
    tolerated: facts.tolerated || !isBlocking(e.reaction),
    worst: beatsWorst ? e.reaction : facts.worst,
    worstEntryId: beatsWorst ? e.entryId : facts.worstEntryId,
    worstAt: beatsWorst ? e.givenAt : facts.worstAt
  };
}

function factsByAllergen(entries: readonly AllergenEntry[]): Map<string, Facts> {
  const byAllergen = new Map<string, Facts>();
  for (const e of entries) {
    if (!counts(e)) continue;
    const facts = byAllergen.get(e.allergenType);
    byAllergen.set(e.allergenType, facts ? mergeFacts(facts, e) : seedFacts(e));
  }
  return byAllergen;
}

const daysBetween = (from: number, to: number) => Math.max(0, Math.floor((to - from) / DAY_MS));

// One maintenance policy for every reader: tolerated priority allergens with no
// symptoms ever, the most days without a reliable exposure first. The
// reminders take the overdue head, the menu the first entry it can serve, and
// the tile marks overdue ones fading.
function buildMaintainQueue(byAllergen: Map<string, Facts>, now: number): MaintainCandidate[] {
  const queue: MaintainCandidate[] = [];
  for (const id of PRIORITY_INTRODUCTION_ALLERGENS) {
    const facts = byAllergen.get(id);
    if (!facts || isBlocking(facts.worst)) continue;
    const daysSince = daysBetween(facts.lastAt, now);
    queue.push({
      id,
      lastAt: facts.lastAt,
      daysSince,
      overdue: daysSince >= ALLERGEN_MAINTAIN_DAYS
    });
  }
  // By whole days, as the parent reads them; the stable sort keeps
  // PRIORITY_INTRODUCTION_ALLERGENS order within the same day count.
  return queue.sort((a, b) => b.daysSince - a.daysSince);
}

function formatDDMMYY(ms: number): string {
  const { year, month, day } = parisDateParts(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(day)}/${pad(month)}/${pad(year % 100)}`;
}

function buildStatuses(
  byAllergen: Map<string, Facts>,
  queue: readonly MaintainCandidate[],
  now: number
): AllergenItem[] {
  const overdue = new Set(queue.filter((c) => c.overdue).map((c) => c.id));
  return ALLERGENS.map(({ id }): AllergenItem => {
    const label = getAllergenLabel(id);
    const facts = byAllergen.get(id);
    if (!facts) {
      return {
        id,
        label,
        triedCount: 0,
        lastTried: null,
        daysSinceLastTried: null,
        state: 'todo',
        worstEntryId: null
      };
    }
    const worst = facts.worst;
    return {
      id,
      label,
      triedCount: facts.tried,
      lastTried: formatDDMMYY(facts.lastAt),
      daysSinceLastTried: daysBetween(facts.lastAt, now),
      state: worst !== 'ras' ? worst : overdue.has(id) ? 'fading' : 'cleared',
      worstEntryId: facts.worstEntryId
    };
  });
}

// Priority allergens first, then alphabetical on the localized label (French
// collation also orders the English labels sensibly).
function buildBilanRows(byAllergen: Map<string, Facts>): AllergenBilanRow[] {
  return ALLERGENS.map(({ id }): AllergenBilanRow => {
    const facts = byAllergen.get(id);
    return {
      id,
      label: getAllergenLabel(id),
      isPriority: PRIORITY_SET.has(id),
      status: facts ? 'introduced' : 'untested',
      worst: facts?.worst ?? null,
      exposures: facts?.tried ?? 0,
      firstGivenAt: facts?.firstAt ?? null,
      lastGivenAt: facts?.lastAt ?? null
    };
  }).sort(
    (x, y) => Number(!x.isPriority) - Number(!y.isPriority) || x.label.localeCompare(y.label, 'fr')
  );
}

/**
 * Builds the history from rows already in hand (the Bilan's full entry list,
 * or test fixtures). Rows without an allergen are ignored. `now` (epoch ms)
 * anchors every day count, so the queue, 'fading' and the reminders agree.
 */
export function allergenHistoryFrom(
  entries: readonly AllergenEntry[],
  now: number = Date.now()
): AllergenHistory {
  const byAllergen = factsByAllergen(entries);
  const maintainQueue = buildMaintainQueue(byAllergen, now);
  return {
    isIntroduced: (id) => byAllergen.has(id),
    isBlocked: (id) => isBlocking(byAllergen.get(id)?.worst ?? 'ras'),
    isTolerated: (id) => byAllergen.get(id)?.tolerated ?? false,
    maintainQueue,
    statuses: buildStatuses(byAllergen, maintainQueue, now),
    bilanRows: buildBilanRows(byAllergen),
    isExposureFood: isReliableExposure
  };
}

/**
 * Reads the child's whole allergen history in one query, unbounded, so an old
 * reaction never ages out. Synchronous: pass a transaction handle to read
 * inside a write (the log action measures milestones before and after).
 */
export function loadAllergenHistory(
  executor: Executor,
  childId: number,
  now: number = Date.now()
): AllergenHistory {
  const rows = executor
    .select({
      entryId: foodEntries.id,
      allergenType: foods.allergenType,
      category: foods.category,
      reaction: foodEntries.reaction,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
    .all();
  return allergenHistoryFrom(
    rows.map((r) => ({
      ...r,
      reaction: r.reaction as ReactionId,
      givenAt: toEpochMs(r.givenAt as Date | number | string)
    })),
    now
  );
}

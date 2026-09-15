import { and, eq, isNotNull, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { parisDateParts } from '$lib/utils/paris-date';
import {
  ALLERGENS,
  ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY,
  ALLERGEN_MAINTAIN_DAYS,
  PRIORITY_INTRODUCTION_ALLERGENS,
  getAllergenLabel
} from '$lib/utils/allergens';

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

export type AllergenRow = {
  entryId: number;
  allergenType: string | null;
  givenAt: Date | number | string;
  reaction: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

function formatDDMMYY(d: Date): string {
  const { year, month, day } = parisDateParts(d.getTime());
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

// Raw allergen-tagged join, factored out so callers that also need the worst-
// reaction summary (the dashboard) can fetch it once and reuse the rows for
// both, instead of running this same join+where twice per request.
export async function loadAllergenRows(childId: number): Promise<AllergenRow[]> {
  return db
    .select({
      entryId: foodEntries.id,
      allergenType: foods.allergenType,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(
      and(
        eq(foodEntries.childId, childId),
        isNotNull(foods.allergenType),
        or(ne(foods.category, ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY), ne(foodEntries.reaction, 'ras'))
      )
    );
}

// Severity ladder for picking the entry a 'réaction' / 'inconfort' pill should
// link to. Higher wins; ties go to the most recent entry.
const SEVERITY: Record<string, number> = { ras: 0, inconfort: 1, reaction: 2 };

type Aggregate = {
  triedCount: number;
  latest: Date;
  hasInconfort: boolean;
  hasReaction: boolean;
  worstEntryId: number | null;
  worstSeverity: number;
  worstAt: number;
};

/** First row seen for an allergen. A 'ras' row never becomes the worst entry:
 *  there is no reaction page worth linking to. */
function seedAggregate(row: AllergenRow, givenAt: Date): Aggregate {
  const severity = SEVERITY[row.reaction] ?? 0;
  const isWorst = severity > 0;
  return {
    triedCount: 1,
    latest: givenAt,
    hasInconfort: row.reaction === 'inconfort',
    hasReaction: row.reaction === 'reaction',
    worstEntryId: isWorst ? row.entryId : null,
    worstSeverity: isWorst ? severity : 0,
    worstAt: isWorst ? givenAt.getTime() : 0
  };
}

/** Fold a subsequent row into an allergen's running aggregate. */
function mergeAggregate(previous: Aggregate, row: AllergenRow, givenAt: Date): Aggregate {
  const at = givenAt.getTime();
  const severity = SEVERITY[row.reaction] ?? 0;
  const beatsWorst =
    severity > previous.worstSeverity ||
    (severity > 0 && severity === previous.worstSeverity && at > previous.worstAt);
  return {
    triedCount: previous.triedCount + 1,
    latest: previous.latest.getTime() > at ? previous.latest : givenAt,
    hasInconfort: previous.hasInconfort || row.reaction === 'inconfort',
    hasReaction: previous.hasReaction || row.reaction === 'reaction',
    worstEntryId: beatsWorst ? row.entryId : previous.worstEntryId,
    worstSeverity: beatsWorst ? severity : previous.worstSeverity,
    worstAt: beatsWorst ? at : previous.worstAt
  };
}

function aggregateRows(rows: AllergenRow[]): Map<string, Aggregate> {
  const byAllergen = new Map<string, Aggregate>();
  for (const row of rows) {
    // SQL filters `allergenType IS NOT NULL`; the guard is a TS narrowing
    // affordance and unreachable at runtime.
    /* v8 ignore next */
    if (!row.allergenType) continue;
    const givenAt =
      row.givenAt instanceof Date
        ? row.givenAt
        : /* v8 ignore next */ new Date(Number(row.givenAt));
    const previous = byAllergen.get(row.allergenType);
    byAllergen.set(
      row.allergenType,
      previous ? mergeAggregate(previous, row, givenAt) : seedAggregate(row, givenAt)
    );
  }
  return byAllergen;
}

/**
 * Worst observed outcome wins, then staleness. 'fading' applies only to the
 * priority-introduction set: a non-priority allergen going quiet is not a
 * thing to chase.
 */
function deriveState(
  agg: Aggregate,
  daysSince: number,
  isPriority: boolean
): AllergenItem['state'] {
  if (agg.hasReaction) return 'reaction';
  if (agg.hasInconfort) return 'inconfort';
  if (isPriority && daysSince >= ALLERGEN_MAINTAIN_DAYS) return 'fading';
  return 'cleared';
}

/**
 * For each of the 12 tracked allergens, returns trial count, last-tried date,
 * days-since, and a derived state (cleared / todo / discomfort / reaction / fading).
 * Shared between the carnet allergens segment and the Discover passport.
 */
export function summarizeAllergenRows(rows: AllergenRow[], now: Date = new Date()): AllergenItem[] {
  const byAllergen = aggregateRows(rows);

  return ALLERGENS.map((a) => {
    const label = getAllergenLabel(a.id);
    const agg = byAllergen.get(a.id);
    if (!agg) {
      return {
        id: a.id,
        label,
        triedCount: 0,
        lastTried: null,
        daysSinceLastTried: null,
        state: 'todo' as const,
        worstEntryId: null
      };
    }
    const daysSince = Math.max(0, Math.floor((now.getTime() - agg.latest.getTime()) / DAY_MS));
    return {
      id: a.id,
      label,
      triedCount: agg.triedCount,
      lastTried: formatDDMMYY(agg.latest),
      daysSinceLastTried: daysSince,
      state: deriveState(agg, daysSince, PRIORITY_SET.has(a.id)),
      worstEntryId: agg.worstEntryId
    };
  });
}

/** Convenience wrapper for callers that don't already have the rows (fetches then summarizes). */
export async function loadAllergenStatus(
  childId: number,
  now: Date = new Date()
): Promise<AllergenItem[]> {
  return summarizeAllergenRows(await loadAllergenRows(childId), now);
}

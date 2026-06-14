// Single source of truth for the "repeat-exposure candidate" predicate used
// across the dashboard reminder, the carnet repeat filter, and the diversity
// metric.
//
// A food counts as a "repeat candidate" when it has been logged few times
// AND its worst reaction so far has been tolerable (ras or inconfort) — the
// kind of food worth re-offering to consolidate acceptance. The predicate
// lives here so the three SQL forms (loadDiversityMetrics count,
// loadRepeatCandidates list, /child/[id]/foods?repeat=1 filter) and the
// in-JS form (reminders.ts rule 6) can never drift apart again.

import { REACTION_RANK } from '$lib/utils/reaction-values';
import type { AllergenId } from '$lib/utils/allergens';
import type { EnrichedEntry } from './queries';

/** Maximum exposure count (inclusive) for a food to count as a repeat candidate. */
export const REPEAT_CANDIDATE_MAX_COUNT = 2;

/**
 * Maximum worst-reaction rank (inclusive). 0=ras, 1=inconfort, 2=reaction;
 * <=1 means foods that triggered a frank reaction are excluded from
 * "reproposez" prompts.
 */
export const REPEAT_CANDIDATE_MAX_WORST_RANK = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RepeatCandidateView = {
  foodId: number;
  foodName: string;
  count: number;
  worstRank: number;
  lastGivenAt: number;
  allergenType: string | null;
};

export type FindRepeatCandidatesOptions = {
  /** Maximum exposure count (inclusive). Defaults to REPEAT_CANDIDATE_MAX_COUNT. */
  maxCount?: number;
  /** Maximum worst-reaction rank (inclusive). Defaults to REPEAT_CANDIDATE_MAX_WORST_RANK. */
  maxWorstRank?: number;
  /**
   * Optional cooldown in days since the food was last given. Foods whose
   * last exposure is <= N days ago are excluded. Used by reminders rule 6
   * with N=3 so we don't surface a "Reproposez" card right after the food
   * was logged.
   */
  minDaysSinceLastGiven?: number;
  /**
   * Optional allergen exclusion set. Used by reminders so the generic
   * "reproposez" card doesn't compete with the priority-allergen
   * maintain rule on the same dashboard.
   */
  excludeAllergens?: ReadonlySet<AllergenId>;
  /** Reference timestamp for the days-since computation. Defaults to Date.now(). */
  now?: number;
};

/**
 * Pure-JS implementation of the repeat-candidate predicate. Consumes an
 * already-loaded EnrichedEntry array (e.g. the same full-history list the
 * reminders engine receives) and returns the foods that match the
 * threshold + exclusion options.
 */
export function findRepeatCandidates(
  entries: ReadonlyArray<EnrichedEntry>,
  opts: FindRepeatCandidatesOptions = {}
): RepeatCandidateView[] {
  const {
    maxCount = REPEAT_CANDIDATE_MAX_COUNT,
    maxWorstRank = REPEAT_CANDIDATE_MAX_WORST_RANK,
    minDaysSinceLastGiven,
    excludeAllergens,
    now = Date.now()
  } = opts;

  const perFood = new Map<number, RepeatCandidateView>();
  for (const e of entries) {
    const cur = perFood.get(e.foodId);
    if (!cur) {
      perFood.set(e.foodId, {
        foodId: e.foodId,
        foodName: e.foodName,
        count: 1,
        worstRank: REACTION_RANK[e.reaction],
        lastGivenAt: e.givenAt,
        allergenType: e.allergenType
      });
    } else {
      cur.count += 1;
      cur.worstRank = Math.max(cur.worstRank, REACTION_RANK[e.reaction]);
      cur.lastGivenAt = Math.max(cur.lastGivenAt, e.givenAt);
    }
  }

  const out: RepeatCandidateView[] = [];
  for (const v of perFood.values()) {
    if (v.count > maxCount) continue;
    if (v.worstRank > maxWorstRank) continue;
    if (excludeAllergens && v.allergenType && excludeAllergens.has(v.allergenType as AllergenId)) {
      continue;
    }
    if (minDaysSinceLastGiven != null && now - v.lastGivenAt <= minDaysSinceLastGiven * DAY_MS) {
      continue;
    }
    out.push(v);
  }
  return out;
}

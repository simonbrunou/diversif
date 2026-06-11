import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import {
  ALLERGENS,
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
  state: 'cleared' | 'todo' | 'reaction' | 'fading';
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

function formatDDMMYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}

/**
 * For each of the 12 tracked allergens, returns trial count, last-tried date,
 * days-since, and a derived state (cleared / todo / reaction / fading).
 * Shared between the carnet allergens segment and the Discover passport.
 */
export async function loadAllergenStatus(
  childId: number,
  now: Date = new Date()
): Promise<AllergenItem[]> {
  const rows = await db
    .select({
      allergenType: foods.allergenType,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)));

  const byAllergen = new Map<string, { triedCount: number; latest: Date; hasReaction: boolean }>();
  for (const r of rows) {
    // SQL filters `allergenType IS NOT NULL`; the guard is a TS narrowing
    // affordance and unreachable at runtime.
    /* v8 ignore next */
    if (!r.allergenType) continue;
    const givenAt =
      r.givenAt instanceof Date ? r.givenAt : /* v8 ignore next */ new Date(Number(r.givenAt));
    const bucket = byAllergen.get(r.allergenType);
    if (bucket) {
      bucket.triedCount += 1;
      if (givenAt.getTime() > bucket.latest.getTime()) bucket.latest = givenAt;
      if (r.reaction === 'reaction') bucket.hasReaction = true;
    } else {
      byAllergen.set(r.allergenType, {
        triedCount: 1,
        latest: givenAt,
        hasReaction: r.reaction === 'reaction'
      });
    }
  }

  return ALLERGENS.map((a) => {
    const b = byAllergen.get(a.id);
    if (!b) {
      return {
        id: a.id,
        label: getAllergenLabel(a.id),
        triedCount: 0,
        lastTried: null,
        daysSinceLastTried: null,
        state: 'todo' as const
      };
    }
    const daysSince = Math.max(0, Math.floor((now.getTime() - b.latest.getTime()) / DAY_MS));
    const isPriority = PRIORITY_SET.has(a.id);
    let state: AllergenItem['state'];
    if (b.hasReaction) {
      state = 'reaction';
    } else if (isPriority && daysSince > ALLERGEN_MAINTAIN_DAYS) {
      state = 'fading';
    } else {
      state = 'cleared';
    }
    return {
      id: a.id,
      label: getAllergenLabel(a.id),
      triedCount: b.triedCount,
      lastTried: formatDDMMYY(b.latest),
      daysSinceLastTried: daysSince,
      state
    };
  });
}

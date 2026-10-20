import { civilDayOfDate, parisDayOf } from './civil-calendar';

// A phone or server clock a few minutes fast shouldn't block logging "now" —
// give givenAt this much slack above the server's now before calling it
// future-dated.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type MealDateErrorKey = 'errorsLogDateFuture' | 'errorsLogDateBeforeBirth';

/**
 * Bounds-checks a meal's givenAt against "now" and the child's birth date.
 * The repas write module (src/lib/server/repas) applies it to every write,
 * inside the write's own transaction. Mirrors
 * formatAge's Europe/Paris civil-day comparison (src/lib/utils/age.ts) so a
 * meal logged on the child's birth day is accepted, matching "aujourd’hui".
 */
export function mealDateError(
  givenAt: Date,
  birthDate: string,
  nowMs: number
): MealDateErrorKey | null {
  if (givenAt.getTime() > nowMs + FUTURE_TOLERANCE_MS) {
    return 'errorsLogDateFuture';
  }

  if (parisDayOf(givenAt.getTime()) < civilDayOfDate(birthDate)) {
    return 'errorsLogDateBeforeBirth';
  }

  return null;
}

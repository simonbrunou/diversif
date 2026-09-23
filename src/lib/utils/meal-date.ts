import { parisDayIndex } from './paris-date';

// A phone or server clock a few minutes fast shouldn't block logging "now" —
// give givenAt this much slack above the server's now before calling it
// future-dated.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type MealDateErrorKey = 'errorsLogDateFuture' | 'errorsLogDateBeforeBirth';

/**
 * Bounds-checks a meal's givenAt against "now" and the child's birth date.
 * Shared by every write path (create, single-entry edit, whole-meal edit) so
 * the three server actions agree on the same tolerance and calendar. Mirrors
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

  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const birthDayIndex = Math.floor(Date.UTC(birthYear, birthMonth - 1, birthDay) / 86_400_000);
  if (parisDayIndex(givenAt.getTime()) < birthDayIndex) {
    return 'errorsLogDateBeforeBirth';
  }

  return null;
}

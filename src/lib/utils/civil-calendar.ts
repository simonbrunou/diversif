// The app's notions of "day", in one place. Day numbers, daily buckets,
// "N days since" counts and rolling windows go through here, so the
// millisecond arithmetic lives in one module, and DAY_MS is its one
// declaration. Code that only reads a Paris date's year, month or day (age in
// months, display, typed symptom times) calls parisDateParts directly. TTLs
// in seconds (the service worker's caches, the theme cookie) stay with their
// owners. Plain util, usable from both server and client code.
//
// Three notions, each named after what it counts:
// - the Paris civil day (parisDayOf, parisDaysAgo, lastDays, thisWeek,
//   isThisWeek): the date a parent in France reads on the wall clock. The
//   default for anything shown as "today", "yesterday" or "this week".
// - the UTC day (utcDayOf): a fixed 24-hour bucket that ignores time zones.
//   Only for the recorded choices that use it on purpose.
// - elapsed time (elapsedDays, daysBefore, DAY_MS): whole 24-hour periods,
//   for "N days since" counts, rolling windows and TTLs, regardless of the
//   calendar.
//
// Every function takes the instants it compares; none reads the clock. The
// caller reads `now` once per request and passes it down.
import { parisDateParts } from './paris-date';

/** A calendar date as a day number: days since 1970-01-01. */
export type CivilDay = number;

/** 24 hours in ms: a duration, for TTLs. */
export const DAY_MS = 86_400_000;

// « Cette semaine »: today and the 6 days before it.
const WEEK_DAYS = 7;

/**
 * The day number of `year`-`month`-`day` (month 1-12). An out-of-range month
 * or day rolls over as Date.UTC does: day 0 is the last day of the month
 * before, month 13 is January of the next year.
 */
export function civilDay(year: number, month: number, day: number): CivilDay {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** The day number of a `YYYY-MM-DD` date, such as a birth date. */
export function civilDayOfDate(date: string): CivilDay {
  const [year, month, day] = date.split('-').map(Number);
  return civilDay(year, month, day);
}

/** The Paris civil day of an instant, whatever the server's or browser's zone. */
export function parisDayOf(at: number): CivilDay {
  const { year, month, day } = parisDateParts(at);
  return civilDay(year, month, day);
}

/**
 * How many Paris days `at` lies before `now`: 0 for today, 1 for yesterday,
 * negative after today. Counts dates, not hours: 23:50 the evening before is
 * 1 day ago at 00:30.
 */
export function parisDaysAgo(at: number, now: number): number {
  return parisDayOf(now) - parisDayOf(at);
}

/** The `n` days ending on `today`, oldest first. */
export function lastDays(n: number, today: CivilDay): CivilDay[] {
  return Array.from({ length: n }, (_, i) => today - (n - 1) + i);
}

/**
 * This week, wherever the app says « cette semaine »: today and the 6 Paris
 * days before it, oldest first. The Carnet's 7 bars.
 */
export function thisWeek(now: number): CivilDay[] {
  return lastDays(WEEK_DAYS, parisDayOf(now));
}

/**
 * Whether `at` falls in thisWeek, or after today: a meal may be dated a few
 * minutes ahead of the server's clock. Aujourd'hui's new foods and co-parent
 * activity.
 */
export function isThisWeek(at: number, now: number): boolean {
  return parisDaysAgo(at, now) < WEEK_DAYS;
}

/**
 * The UTC midnight that names `day`. Paris is ahead of UTC all year, so
 * Intl with `timeZone: 'Europe/Paris'` prints this instant as that same
 * date, and parisDayOf maps it back to `day`. Use it to label a day, not as
 * the instant the Paris day starts, which comes 1 or 2 hours earlier.
 */
export function utcMidnightOf(day: CivilDay): number {
  return day * DAY_MS;
}

/** Monday-origin weekday: 0 for Monday to 6 for Sunday. Day 0 was a Thursday. */
export function weekdayOf(day: CivilDay): number {
  return (((day + 3) % 7) + 7) % 7;
}

/**
 * The UTC day of an instant, numbered like a CivilDay: it turns over at
 * 01:00 or 02:00 Paris time, not at midnight. Two recorded choices use it on
 * purpose: Régularité (see buildStreak in child-history.ts) and the key of a
 * maintain-allergen card, which dismissals already store (ruleMaintainAllergens
 * in reminders.ts).
 */
export function utcDayOf(at: number): CivilDay {
  return Math.floor(at / DAY_MS);
}

/** Whole 24-hour periods from `from` to `to`; 0 when `from` is after `to`. */
export function elapsedDays(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

/** The instant `n` × 24 hours before `now`: where a rolling window of `n` days starts. */
export function daysBefore(now: number, n: number): number {
  return now - n * DAY_MS;
}

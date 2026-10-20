// The app's notions of "day", in one place. Every count of days, every daily
// bucket and every "today" goes through here, so the millisecond arithmetic
// and the Europe/Paris conversion live in one module. Plain util, usable from
// both server and client code.
//
// Three notions, each named after what it counts:
// - the Paris civil day (parisDayOf, parisDaysAgo, lastDays, thisWeek): the
//   date a parent in France reads on the wall clock. The default for anything
//   shown as "today", "yesterday" or "this week".
// - the UTC day (utcDayOf): a fixed 24-hour bucket that ignores time zones.
//   Only for the recorded choices that use it on purpose.
// - elapsed time (elapsedDays, DAY_MS): whole 24-hour periods, for "N days
//   since" counts and rolling windows, regardless of the calendar.
//
// Every function takes the instants it compares; none reads the clock. The
// caller reads `now` once per request and passes it down.
import { parisDateParts } from './paris-date';

/** A calendar date as a day number: days since 1970-01-01. */
type CivilDay = number;

/** 24 hours in ms: a duration, for TTLs and rolling windows. */
export const DAY_MS = 86_400_000;

/**
 * The day number of `year`-`month`-`day` (month 1-12). An out-of-range month
 * or day rolls over as Date.UTC does: day 0 is the last day of the month
 * before, month 13 is January of the next year.
 */
export function civilDay(year: number, month: number, day: number): CivilDay {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
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
 * days before it, oldest first. The Carnet's 7 bars, Aujourd'hui's new foods
 * and co-parent activity.
 */
export function thisWeek(now: number): CivilDay[] {
  return lastDays(7, parisDayOf(now));
}

/**
 * The UTC midnight that names `day`. Paris is ahead of UTC all year, so
 * Intl with `timeZone: 'Europe/Paris'` prints this instant as that same
 * date, and parisDayOf maps it back to `day`. Use it to label a day, not as
 * the instant the Paris day starts.
 */
export function civilDayInstant(day: CivilDay): number {
  return day * DAY_MS;
}

/** Monday-origin weekday: 0 for Monday to 6 for Sunday. Day 0 was a Thursday. */
export function weekdayOf(day: CivilDay): number {
  return (((day + 3) % 7) + 7) % 7;
}

/**
 * The UTC day of an instant: it turns over at 01:00 or 02:00 Paris time, not
 * at midnight. Two recorded choices use it on purpose: Régularité (see
 * buildStreak in child-history.ts) and the key of a maintain-allergen card,
 * which dismissals already store (ruleMaintainAllergens in reminders.ts).
 */
export function utcDayOf(at: number): number {
  return Math.floor(at / DAY_MS);
}

/** Whole 24-hour periods from `from` to `to`; 0 when `from` is after `to`. */
export function elapsedDays(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

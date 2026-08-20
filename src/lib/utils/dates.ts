import { getLocale } from '$lib/paraglide/runtime';
import * as m from '$lib/paraglide/messages';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHHmm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRelative(date: Date | number, now: Date = new Date()): string {
  const locale = getLocale();
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return m.dateRelativeNow();
  if (diffMin < 60) return m.dateRelativeMinutes({ min: String(diffMin) });
  if (diffHour < 12 && isSameDay(d, now)) return m.dateRelativeHours({ hour: String(diffHour) });

  if (isSameDay(d, now)) return m.dateRelativeToday({ time: formatHHmm(d) });
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(d, yesterday)) return m.dateRelativeYesterday({ time: formatHHmm(d) });

  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  if (d.getFullYear() === now.getFullYear())
    return `${weekday} ${d.getDate()} ${month} ${formatHHmm(d)}`;
  return `${d.getDate()} ${month} ${d.getFullYear()} ${formatHHmm(d)}`;
}

export function formatDateInputValue(date: Date = new Date()): string {
  // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${formatHHmm(date)}`;
}

// <input type="datetime-local"> produces TZ-naive strings ("2026-05-17T12:27").
// Per ECMA-262, the server parses those in *its* local TZ — typically UTC in
// containers — so a user's "12:27 CEST" round-trips as "12:27 UTC" and the
// browser then re-renders it as "14:27 CEST" (+2h). Anchoring to ISO here on
// the client closes that gap before the form leaves the browser.
export function localInputToIso(value: string): string {
  if (!value) return value;
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

/**
 * Returns true only for a real calendar date in YYYY-MM-DD form. Catches
 * shape errors (`2026-99-99`) and impossible days (`2024-02-30`) by
 * round-tripping through Date and re-encoding to ISO.
 */
export function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === value;
}

/**
 * Format a date for the given locale. Default `style="medium"` includes the
 * year ("1 mars 2026"); `style="short"` omits it ("1 mars") for surfaces where
 * the year is redundant context (today's log, recent entries).
 */
export function formatDate(
  d: Date | string | number,
  locale: string,
  options: { style?: 'medium' | 'short' } = {}
): string {
  const date = d instanceof Date ? d : new Date(d);
  if (options.style === 'short') {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

/**
 * Format a time using the short timeStyle for the given locale.
 * E.g. "14:27" (fr-FR) or "2:27 PM" (en-US).
 */
export function formatTime(d: Date | string | number, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
}

/**
 * Coerce a Date, epoch milliseconds number, or ISO string to milliseconds
 * since epoch. Useful for serialising dates over the page/server boundary.
 */
export function toEpochMs(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

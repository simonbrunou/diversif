import { getLocale } from '#lib/paraglide/runtime.js';
import * as m from '#lib/paraglide/messages.js';
import { parisDaysAgo } from './civil-calendar';
import { PARIS_TIME_ZONE, parisDateParts } from './paris-date';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatHHmm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const PARIS_HH_MM_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: PARIS_TIME_ZONE
});

/**
 * When an entry was logged, as the feed prints it: « il y a 5 min »,
 * « hier 20:15 ». Days and hours are read in Paris, like the entry page, so
 * the server (UTC) and the browser render the same text.
 */
export function formatRelative(date: Date | number, now: Date = new Date()): string {
  const locale = getLocale();
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const daysAgo = parisDaysAgo(d.getTime(), now.getTime());
  const time = PARIS_HH_MM_FORMATTER.format(d);

  if (diffMin < 1) return m.dateRelativeNow();
  if (diffMin < 60) return m.dateRelativeMinutes({ min: String(diffMin) });
  if (daysAgo === 0 && diffHour < 12) return m.dateRelativeHours({ hour: String(diffHour) });
  if (daysAgo === 0) return m.dateRelativeToday({ time });
  if (daysAgo === 1) return m.dateRelativeYesterday({ time });

  const inParis = { timeZone: PARIS_TIME_ZONE };
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', ...inParis }).format(d);
  const month = new Intl.DateTimeFormat(locale, { month: 'short', ...inParis }).format(d);
  const { year, day } = parisDateParts(d.getTime());
  if (year === parisDateParts(now.getTime()).year) return `${weekday} ${day} ${month} ${time}`;
  return `${day} ${month} ${year} ${time}`;
}

/**
 * YYYY-MM-DDTHH:mm for <input type="datetime-local">, in the host's zone: the
 * browser's, the zone `localInputToIso` converts from. The server, whose zone
 * is UTC in production, renders `formatParisDateTimeLocal` instead (#485).
 */
export function formatDateInputValue(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${formatHHmm(date)}`;
}

// <input type="datetime-local"> produces TZ-naive strings ("2026-05-17T12:27").
// The server reads those as Paris time (parseParisDateTimeLocal), which is
// right for a form posted without JavaScript. With JavaScript, anchoring to
// ISO here reads the value in the browser's zone instead, so a parent outside
// France keeps the local time they typed.
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
  options: { style?: 'medium' | 'short'; timeZone?: string } = {}
): string {
  const date = d instanceof Date ? d : new Date(d);
  if (options.style === 'short') {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: options.timeZone
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: options.timeZone
  }).format(date);
}

/**
 * Format a time using the short timeStyle for the given locale.
 * E.g. "14:27" (fr-FR) or "2:27 PM" (en-US).
 */
export function formatTime(
  d: Date | string | number,
  locale: string,
  options: { timeZone?: string } = {}
): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: options.timeZone }).format(
    date
  );
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

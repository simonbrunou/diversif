import dayjs from 'dayjs';
import 'dayjs/locale/fr';
// dayjs ships English as the built-in default locale, so no separate import.
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import updateLocale from 'dayjs/plugin/updateLocale';
import { languageTag } from '$lib/paraglide/runtime';
import * as m from '$lib/paraglide/messages';

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(updateLocale);

// Calling dayjs.locale() at module load globalised French for every
// downstream dayjs() call, including pages rendered for /en/ visitors.
// Pass the active paraglide tag per call instead so each render picks up
// the visitor's locale; the helpers below resolve it via languageTag()
// (which hooks.server.ts sets per request and the layout effect keeps in
// sync after client-side navigations).

export function formatRelative(date: Date | number, now: Date = new Date()): string {
  const locale = languageTag();
  const d = dayjs(date).locale(locale);
  const n = dayjs(now).locale(locale);
  const diffMin = n.diff(d, 'minute');
  const diffHour = n.diff(d, 'hour');

  if (diffMin < 1) return m.dateRelativeNow();
  if (diffMin < 60) return m.dateRelativeMinutes({ min: String(diffMin) });
  if (diffHour < 12 && d.isSame(n, 'day')) return m.dateRelativeHours({ hour: String(diffHour) });

  if (d.isSame(n, 'day')) return m.dateRelativeToday({ time: d.format('HH:mm') });
  if (d.isSame(n.subtract(1, 'day'), 'day'))
    return m.dateRelativeYesterday({ time: d.format('HH:mm') });

  if (d.isSame(n, 'year')) return d.format('ddd D MMM HH:mm');
  return d.format('D MMM YYYY HH:mm');
}

export function formatDateTime(date: Date | number): string {
  return dayjs(date).locale(languageTag()).format('D MMM YYYY HH:mm');
}

export function formatDateInputValue(date: Date = new Date()): string {
  // YYYY-MM-DDTHH:mm for <input type="datetime-local">
  return dayjs(date).format('YYYY-MM-DDTHH:mm');
}

export function parseDateTimeLocal(value: string): Date {
  return dayjs(value).toDate();
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
 * Returns a locale-aware age in months since birthMonth.
 * E.g. "6 mois" (FR) or "6 mo" (EN).
 */
export function formatMonthsSince(birthMonth: string, now: Date = new Date()): string {
  const locale = languageTag();
  const months = dayjs(now).diff(dayjs(birthMonth), 'month');
  return locale === 'fr' ? `${months} mois` : `${months} mo`;
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
 * Format a date using the medium dateStyle for the given locale.
 * E.g. "1 mars 2026" (fr-FR) or "1 Mar 2026" (en-GB).
 */
export function formatDate(d: Date | string | number, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
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

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

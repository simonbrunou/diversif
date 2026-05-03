import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import updateLocale from 'dayjs/plugin/updateLocale';

dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(updateLocale);
dayjs.locale('fr');

export function formatRelative(date: Date | number, now: Date = new Date()): string {
  const d = dayjs(date);
  const n = dayjs(now);
  const diffMin = n.diff(d, 'minute');
  const diffHour = n.diff(d, 'hour');

  if (diffMin < 1) return 'à l’instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 12 && d.isSame(n, 'day')) return `il y a ${diffHour} h`;

  if (d.isSame(n, 'day')) return `aujourd’hui ${d.format('HH:mm')}`;
  if (d.isSame(n.subtract(1, 'day'), 'day')) return `hier ${d.format('HH:mm')}`;

  if (d.isSame(n, 'year')) return d.format('ddd D MMM HH:mm');
  return d.format('D MMM YYYY HH:mm');
}

export function formatDateTime(date: Date | number): string {
  return dayjs(date).format('D MMM YYYY HH:mm');
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

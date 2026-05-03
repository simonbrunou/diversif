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

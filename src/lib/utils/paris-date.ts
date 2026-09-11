// Shared Europe/Paris civil-date conversion. The app targets French parents;
// server containers typically run in UTC, so any "which calendar day is this"
// computation (age, last-tried dates, weekly chart buckets) must anchor on
// Europe/Paris local time, not the host's UTC clock. Usable from both server
// and client code (plain util, no `$lib/server` import).
export const PARIS_TIME_ZONE = 'Europe/Paris';

const PARIS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

/** Civil-date (year/month/day) of `ms` in Europe/Paris, independent of server/browser TZ. */
export function parisDateParts(ms: number): { year: number; month: number; day: number } {
  // en-CA formats as YYYY-MM-DD.
  const [year, month, day] = PARIS_FORMATTER.format(new Date(ms)).split('-').map(Number);
  return { year, month, day };
}

/** Epoch day index (days since 1970-01-01 UTC) of `ms`'s Europe/Paris civil date. */
export function parisDayIndex(ms: number): number {
  const { year, month, day } = parisDateParts(ms);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

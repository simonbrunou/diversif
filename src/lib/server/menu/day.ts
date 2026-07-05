const PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function parisDay(nowMs: number): { dayIndex: number; weekday: number } {
  // en-CA formats as YYYY-MM-DD; treat it as a plain civil date at UTC midnight.
  const [y, mo, d] = PARIS.format(new Date(nowMs)).split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
  const weekday = (((dayIndex + 3) % 7) + 7) % 7; // epoch day 0 = Thursday (Monday-origin index 3)
  return { dayIndex, weekday };
}

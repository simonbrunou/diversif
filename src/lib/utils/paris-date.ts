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

const PARIS_WALL_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

/** Re-reads `instantMs` through the Europe/Paris zone and re-encodes the
 * displayed wall-clock fields as if they were UTC. Diffing this against the
 * original instant gives the zone's offset (in minutes east of UTC) that was
 * in effect at that instant — CET (+60) or CEST (+120), without hardcoding
 * either. */
function parisWallClockAsUtcMs(instantMs: number): number {
  const parts = PARIS_WALL_CLOCK_FORMATTER.formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
}

function parisOffsetMinutesAt(instantMs: number): number {
  return (parisWallClockAsUtcMs(instantMs) - instantMs) / 60_000;
}

/** Resolves a Europe/Paris wall-clock instant (`year`-`month`-`day` `hh`:`mm`)
 * to its UTC instant. The offset is re-derived from a first guess (two
 * bounded passes — Europe/Paris only ever observes two offsets, so the
 * second pass always lands on the correct one for a real wall time).
 *
 * `hh`:`mm` on the spring-forward day (the last Sunday of March, 02:00-02:59
 * does not exist) has no real instant: the two passes then oscillate between
 * the pre- and post-transition offsets and this deterministically settles on
 * the post-transition (CEST) reading — e.g. a requested 02:30 resolves to
 * the instant Paris clocks read 03:30. Ambiguous times on the fall-back day
 * (02:00-02:59, both CEST and CET) deterministically resolve to the later
 * (CET) occurrence for the same reason.
 */
function parisWallClockToUtcMs(
  year: number,
  month: number,
  day: number,
  hh: number,
  mm: number
): number {
  const naiveMs = Date.UTC(year, month - 1, day, hh, mm, 0, 0);
  let guessMs = naiveMs;
  for (let i = 0; i < 2; i++) {
    guessMs = naiveMs - parisOffsetMinutesAt(guessMs) * 60_000;
  }
  return guessMs;
}

/** Civil date one day before `year`-`month`-`day`, via plain UTC-date-field
 * arithmetic (`Date.UTC` normalizes overflow, e.g. day 0 rolls to the last
 * day of the previous month) — no timezone conversion involved. */
function previousCivilDate(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day - 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** A typed symptom time defaults to the browser's own clock (AddSymptomSheet),
 * so "now" here is a client reading, not the server's — up to a few seconds
 * ahead if the phone's clock runs fast, or the request lands just after a
 * minute boundary the field was filled before. Without slack, that pushes
 * `todayInstant` past `nowMs` and misdates the symptom to yesterday. 5
 * minutes comfortably covers ordinary clock drift without masking a genuine
 * "typed a time still in the future" case (evenings vs. the following
 * morning are hours apart, not minutes). */
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;

/**
 * Resolves a typed `hh:mm` (a parent recording a symptom just observed) to
 * the most recent instant at or before `nowMs` whose Europe/Paris wall clock
 * reads `hh:mm` — today's Paris civil date, or yesterday's if today's
 * occurrence would still be in the future (e.g. "21:30" typed at 08:00 means
 * last night, not later today). Today's occurrence is accepted even up to
 * `CLOCK_SKEW_TOLERANCE_MS` ahead of `nowMs`, to absorb ordinary client/server
 * clock skew.
 */
export function latestParisWallClock(hh: number, mm: number, nowMs: number): Date {
  const today = parisDateParts(nowMs);
  const todayInstant = parisWallClockToUtcMs(today.year, today.month, today.day, hh, mm);
  if (todayInstant <= nowMs + CLOCK_SKEW_TOLERANCE_MS) return new Date(todayInstant);
  const prev = previousCivilDate(today.year, today.month, today.day);
  return new Date(parisWallClockToUtcMs(prev.year, prev.month, prev.day, hh, mm));
}

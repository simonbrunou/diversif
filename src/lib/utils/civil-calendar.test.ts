import { describe, expect, it } from 'bun:test';
import {
  DAY_MS,
  civilDay,
  civilDayOfDate,
  daysBefore,
  elapsedDays,
  isThisWeek,
  lastDays,
  parisDayOf,
  parisDaysAgo,
  thisWeek,
  utcDayOf,
  utcMidnightOf,
  weekdayOf
} from './civil-calendar';

// Fixed instants, read as a parent in Paris would. 2026 changes clocks on
// Sunday 29 March (02:00 CET -> 03:00 CEST, a 23-hour day) and on Sunday
// 25 October (03:00 CEST -> 02:00 CET, a 25-hour day).
const at = (iso: string) => Date.parse(iso);

describe('civilDay', () => {
  it('numbers calendar dates from 1970-01-01', () => {
    expect(civilDay(1970, 1, 1)).toBe(0);
    expect(civilDay(2026, 6, 2)).toBe(20606);
  });

  it('rolls an out-of-range month or day over, as Date.UTC does', () => {
    expect(civilDay(2026, 3, 0)).toBe(civilDay(2026, 2, 28));
    expect(civilDay(2026, 13, 1)).toBe(civilDay(2027, 1, 1));
  });
});

describe('civilDayOfDate', () => {
  it('reads a YYYY-MM-DD date, such as a birth date', () => {
    expect(civilDayOfDate('2026-06-02')).toBe(20606);
    expect(civilDayOfDate('1970-01-01')).toBe(0);
  });
});

describe('parisDayOf', () => {
  it('turns over at Paris midnight, not UTC midnight, in summer', () => {
    // 22:30Z is 00:30 CEST on 2 June.
    expect(parisDayOf(at('2026-06-01T21:59:00Z'))).toBe(civilDay(2026, 6, 1));
    expect(parisDayOf(at('2026-06-01T22:30:00Z'))).toBe(civilDay(2026, 6, 2));
  });

  it('turns over at Paris midnight in winter, an hour later in UTC', () => {
    // 23:30Z is 00:30 CET on 10 January.
    expect(parisDayOf(at('2026-01-09T22:59:00Z'))).toBe(civilDay(2026, 1, 9));
    expect(parisDayOf(at('2026-01-09T23:30:00Z'))).toBe(civilDay(2026, 1, 10));
  });

  it('spans the 23 hours of the spring-forward day', () => {
    const springForward = civilDay(2026, 3, 29);
    expect(parisDayOf(at('2026-03-28T22:59:00Z'))).toBe(springForward - 1);
    expect(parisDayOf(at('2026-03-28T23:00:00Z'))).toBe(springForward); // 00:00 CET
    expect(parisDayOf(at('2026-03-29T21:59:00Z'))).toBe(springForward); // 23:59 CEST
    expect(parisDayOf(at('2026-03-29T22:00:00Z'))).toBe(springForward + 1);
  });

  it('spans the 25 hours of the fall-back day', () => {
    const fallBack = civilDay(2026, 10, 25);
    expect(parisDayOf(at('2026-10-24T21:59:00Z'))).toBe(fallBack - 1);
    expect(parisDayOf(at('2026-10-24T22:00:00Z'))).toBe(fallBack); // 00:00 CEST
    expect(parisDayOf(at('2026-10-25T22:59:00Z'))).toBe(fallBack); // 23:59 CET
    expect(parisDayOf(at('2026-10-25T23:00:00Z'))).toBe(fallBack + 1);
  });
});

describe('parisDaysAgo', () => {
  const now = at('2026-06-01T22:35:00Z'); // 00:35 Paris, 2 June

  it('counts Paris days, so 23:50 the evening before is yesterday', () => {
    expect(parisDaysAgo(at('2026-06-01T22:30:00Z'), now)).toBe(0);
    expect(parisDaysAgo(at('2026-06-01T21:50:00Z'), now)).toBe(1);
  });

  it('reads an instant after today as a negative count', () => {
    expect(parisDaysAgo(at('2026-06-02T22:30:00Z'), now)).toBe(-1);
  });

  it('keeps one day per date across the 25-hour fall-back day', () => {
    // 00:10 CEST to 23:50 CET is 24 h 40 min, still the same Paris day.
    expect(parisDaysAgo(at('2026-10-24T22:10:00Z'), at('2026-10-25T22:50:00Z'))).toBe(0);
  });
});

describe('lastDays', () => {
  it('lists the n days ending today, oldest first', () => {
    const today = civilDay(2026, 6, 2);
    expect(lastDays(3, today)).toEqual([
      civilDay(2026, 5, 31),
      civilDay(2026, 6, 1),
      civilDay(2026, 6, 2)
    ]);
  });
});

describe('thisWeek', () => {
  it('is today and the 6 Paris days before it, from Paris midnight', () => {
    const halfPastMidnight = at('2026-06-01T22:30:00Z'); // 00:30 Paris, 2 June
    expect(thisWeek(halfPastMidnight)).toEqual(lastDays(7, civilDay(2026, 6, 2)));
    expect(thisWeek(halfPastMidnight)[0]).toBe(civilDay(2026, 5, 27));
  });
});

describe('isThisWeek', () => {
  const halfPastMidnight = at('2026-06-01T22:30:00Z'); // 00:30 Paris, Tuesday 2 June

  it('starts at Paris midnight 6 days ago, not 7 × 24 hours ago', () => {
    expect(isThisWeek(at('2026-05-26T22:10:00Z'), halfPastMidnight)).toBe(true); // 00:10, 27 May
    expect(isThisWeek(at('2026-05-26T21:50:00Z'), halfPastMidnight)).toBe(false); // 23:50, 26 May
  });

  it('counts an instant after today: a meal dated a few minutes ahead', () => {
    expect(isThisWeek(at('2026-06-02T22:02:00Z'), at('2026-06-02T21:58:00Z'))).toBe(true);
  });
});

describe('utcMidnightOf', () => {
  it('is the UTC midnight that names the day', () => {
    expect(utcMidnightOf(civilDay(2026, 5, 15))).toBe(Date.UTC(2026, 4, 15));
  });

  it('prints as the same date in Europe/Paris and maps back to the day', () => {
    const paris = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });
    for (const day of [civilDay(2026, 1, 10), civilDay(2026, 3, 29), civilDay(2026, 10, 25)]) {
      const instant = utcMidnightOf(day);
      expect(paris.format(instant)).toBe(new Date(instant).toISOString().slice(0, 10));
      expect(parisDayOf(instant)).toBe(day);
    }
  });
});

describe('weekdayOf', () => {
  it('counts from Monday', () => {
    expect(weekdayOf(civilDay(2026, 7, 6))).toBe(0); // a Monday
    expect(weekdayOf(civilDay(2026, 7, 5))).toBe(6); // a Sunday
    expect(weekdayOf(civilDay(1970, 1, 1))).toBe(3); // a Thursday
  });

  it('stays in 0-6 before 1970', () => {
    expect(weekdayOf(civilDay(1969, 12, 29))).toBe(0); // a Monday
  });
});

describe('utcDayOf', () => {
  it('buckets by UTC date, so 00:30 Paris still falls on the UTC day before', () => {
    const halfPastMidnightInParis = at('2026-06-01T22:30:00Z');
    expect(utcDayOf(halfPastMidnightInParis)).toBe(civilDay(2026, 6, 1));
    expect(parisDayOf(halfPastMidnightInParis)).toBe(civilDay(2026, 6, 2));
  });
});

describe('daysBefore', () => {
  it('is n × 24 hours before now, whatever the calendar', () => {
    expect(daysBefore(at('2026-06-02T10:00:00Z'), 3)).toBe(at('2026-05-30T10:00:00Z'));
    // Across the 25-hour fall-back day, 1 day before 12:00 CET on 25 October
    // is 13:00 CEST on the 24th: 24 hours, not the same time on the clock.
    expect(daysBefore(at('2026-10-25T11:00:00Z'), 1)).toBe(at('2026-10-24T11:00:00Z'));
  });
});

describe('elapsedDays', () => {
  it('counts whole 24-hour periods', () => {
    const from = at('2026-06-01T21:50:00Z');
    expect(elapsedDays(from, from + DAY_MS - 1)).toBe(0);
    expect(elapsedDays(from, from + DAY_MS)).toBe(1);
    expect(elapsedDays(from, from + 3.5 * DAY_MS)).toBe(3);
  });

  it('is 0 for an instant after `to`, never negative', () => {
    expect(elapsedDays(at('2026-06-02T10:00:00Z'), at('2026-06-02T09:59:00Z'))).toBe(0);
  });

  it('measures time, not dates: across the fall-back day 24 h 40 min is one day', () => {
    expect(elapsedDays(at('2026-10-24T22:10:00Z'), at('2026-10-25T22:50:00Z'))).toBe(1);
  });

  it('ignores Paris midnight: 40 minutes across it is 0 days', () => {
    expect(elapsedDays(at('2026-06-01T21:50:00Z'), at('2026-06-01T22:30:00Z'))).toBe(0);
  });
});

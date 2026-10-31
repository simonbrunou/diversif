import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  PARIS_TIME_ZONE,
  formatParisDateTimeLocal,
  parisDateParts,
  parseParisDateTimeLocal,
  latestParisWallClock
} from './paris-date';

function pinHostZone(zone: string): void {
  let hostZone: string | undefined;

  beforeEach(() => {
    hostZone = process.env.TZ;
    process.env.TZ = zone;
  });

  afterEach(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });
}

describe('PARIS_TIME_ZONE', () => {
  it('is the Europe/Paris IANA identifier', () => {
    expect(PARIS_TIME_ZONE).toBe('Europe/Paris');
  });
});

describe('parisDateParts', () => {
  it('reads the Europe/Paris civil date for a UTC instant', () => {
    // 2026-06-01T22:30:00Z is 2026-06-02T00:30 in Paris (CEST, UTC+2).
    expect(parisDateParts(Date.parse('2026-06-01T22:30:00Z'))).toEqual({
      year: 2026,
      month: 6,
      day: 2
    });
  });
});

describe('latestParisWallClock', () => {
  it('resolves a same-day summer (CEST) wall time when it is already past', () => {
    // now = 2026-06-01T10:40:00Z = 12:40 Paris (CEST, +2h). "12:10" is already past today.
    const now = Date.parse('2026-06-01T10:40:00Z');
    expect(latestParisWallClock(12, 10, now).toISOString()).toBe('2026-06-01T10:10:00.000Z');
  });

  it('resolves a same-day winter (CET) wall time when it is already past', () => {
    // now = 2026-01-15T10:00:00Z = 11:00 Paris (CET, +1h). "09:00" is already past today.
    const now = Date.parse('2026-01-15T10:00:00Z');
    expect(latestParisWallClock(9, 0, now).toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });

  it('falls back to the previous Paris civil date when the typed time is later than now', () => {
    // now = 2026-06-02T06:00:00Z = 08:00 Paris. "21:30" today would be in the future,
    // so it resolves to yesterday evening instead.
    const now = Date.parse('2026-06-02T06:00:00Z');
    expect(latestParisWallClock(21, 30, now).toISOString()).toBe('2026-06-01T19:30:00.000Z');
  });

  it('handles the Paris-midnight edge: "now" just after Paris midnight, typed time just before it', () => {
    // now = 2026-06-01T22:30:00Z = 00:30 Paris on 06-02 (CEST). "00:10" today (06-02) is
    // still in the past relative to now, so it must NOT fall back to 06-01.
    const now = Date.parse('2026-06-01T22:30:00Z');
    expect(latestParisWallClock(0, 10, now).toISOString()).toBe('2026-06-01T22:10:00.000Z');
  });

  it('does not throw for a non-existent wall time on the spring-forward day', () => {
    // 2026-03-29 is the last Sunday of March: Paris clocks jump 02:00 -> 03:00 CEST,
    // so 02:30 never happens. "now" is later the same day so the today-branch resolves it.
    const now = Date.parse('2026-03-29T12:00:00Z');
    const result = latestParisWallClock(2, 30, now);
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
    // Documented resolution: settles on the post-transition (CEST) reading, i.e. the
    // instant Paris clocks read 03:30 (one hour after the requested, skipped, 02:30).
    expect(result.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('is deterministic (does not loop) across repeated calls for the same DST-gap input', () => {
    const now = Date.parse('2026-03-29T12:00:00Z');
    const first = latestParisWallClock(2, 30, now).toISOString();
    const second = latestParisWallClock(2, 30, now).toISOString();
    expect(second).toBe(first);
  });

  it('resolves the later (CET) occurrence of an ambiguous wall time on the fall-back day', () => {
    // 2026-10-25 is the last Sunday of October: Paris clocks fall back from
    // 03:00 CEST to 02:00 CET, so 02:30 happens twice. "now" is later the
    // same day so the today-branch resolves it.
    const now = Date.parse('2026-10-25T12:00:00Z');
    // 2026-10-25T01:30:00Z reads as 02:30 CET (GMT+1) in Paris — the later,
    // post-transition occurrence.
    expect(latestParisWallClock(2, 30, now).toISOString()).toBe('2026-10-25T01:30:00.000Z');
  });

  it('tolerates a typed time up to 5 minutes ahead of "now" (client/server clock skew)', () => {
    // now = 2026-06-01T10:30:30Z = 12:30:30 Paris. "12:32" is 1m30s ahead of
    // now — e.g. the browser prefilled the field with its own clock, which
    // ticked past the second the request left it. Still resolves to today.
    const now = Date.parse('2026-06-01T10:30:30Z');
    expect(latestParisWallClock(12, 32, now).toISOString()).toBe('2026-06-01T10:32:00.000Z');
  });

  it('still falls back to the previous day once the typed time is beyond the skew tolerance', () => {
    // now = 2026-06-01T10:30:30Z = 12:30:30 Paris. "12:40" is 9m30s ahead —
    // beyond the 5-minute skew tolerance — so it resolves to yesterday.
    const now = Date.parse('2026-06-01T10:30:30Z');
    expect(latestParisWallClock(12, 40, now).toISOString()).toBe('2026-05-31T10:40:00.000Z');
  });

  it('resolves a typed time just after Paris midnight when "now" is a few minutes before it, ahead-clock skew', () => {
    // now = 2026-06-01T21:58:00Z = 23:58 Paris (June 1 civil date). Typed
    // "00:01" means "just now, past midnight" — within the 5-minute skew
    // tolerance of the upcoming June 2 midnight — not 00:01 on the morning
    // that already happened (which would be nearly a full day in the past).
    const now = Date.parse('2026-06-01T21:58:00Z');
    expect(latestParisWallClock(0, 1, now).toISOString()).toBe('2026-06-01T22:01:00.000Z');
  });

  it('resolves the earlier (CEST) occurrence of an ambiguous fall-back time when the later one is still ahead', () => {
    // now = 2026-10-25T00:45:00Z = 02:45 CEST Paris — inside the first 02:xx
    // hour, before the fall-back transition. The later (CET) occurrence of
    // "02:30" is still in the future from here, so this must resolve to the
    // earlier (CEST) occurrence that already happened minutes ago, not roll
    // back a whole day to yesterday's 02:30.
    const now = Date.parse('2026-10-25T00:45:00Z');
    expect(latestParisWallClock(2, 30, now).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });
});

// A repas form's datetime-local value (#485): the server renders and reads it
// in UTC in production, and a browser anywhere.
describe.each(['UTC', 'Europe/Paris', 'America/Montreal', 'Asia/Tokyo'])(
  'datetime-local values in Paris time, on a host in %s',
  (zone) => {
    pinHostZone(zone);

    describe('formatParisDateTimeLocal', () => {
      it.each([
        ['a summer instant (CEST)', '2026-06-01T10:00:00Z', '2026-06-01T12:00'],
        ['a winter instant (CET)', '2026-01-15T10:00:00Z', '2026-01-15T11:00'],
        ['an instant past Paris midnight', '2026-06-01T22:30:00Z', '2026-06-02T00:30']
      ])('gives what Paris clocks read at %s', (_, iso, value) => {
        expect(formatParisDateTimeLocal(new Date(iso))).toBe(value);
      });
    });

    describe('parseParisDateTimeLocal', () => {
      it.each([
        ['a summer time (CEST)', '2026-06-01T12:30', '2026-06-01T10:30:00.000Z'],
        ['a winter time (CET)', '2026-01-15T12:30', '2026-01-15T11:30:00.000Z'],
        ['a time with seconds', '2026-06-01T12:30:45', '2026-06-01T10:30:45.000Z'],
        ['a time with milliseconds', '2026-06-01T12:30:45.5', '2026-06-01T10:30:45.500Z'],
        ['a time past Paris midnight', '2026-06-02T00:10', '2026-06-01T22:10:00.000Z'],
        // 02:00 to 02:59 does not exist: 02:30 reads as 03:30 CEST.
        ['the skipped hour', '2026-03-29T02:30', '2026-03-29T01:30:00.000Z'],
        ['the minute after the jump', '2026-03-29T03:00', '2026-03-29T01:00:00.000Z'],
        // 02:00 to 02:59 happens twice: 02:30 reads as the first, CEST one.
        ['the repeated hour', '2026-10-25T02:30', '2026-10-25T00:30:00.000Z'],
        ['the minute after the repeat', '2026-10-25T03:00', '2026-10-25T02:00:00.000Z']
      ])('reads %s as Paris time', (_, value, iso) => {
        expect(parseParisDateTimeLocal(value).toISOString()).toBe(iso);
      });

      it.each(['2026-06-01T10:30:00Z', '2026-06-01T10:30:00.000Z', '2026-06-01T12:30:00+02:00'])(
        'reads %s, which carries a zone, as that instant',
        (value) => {
          expect(parseParisDateTimeLocal(value).toISOString()).toBe('2026-06-01T10:30:00.000Z');
        }
      );

      it.each(['2026-02-30T10:00', '2026-13-01T10:00', '2026-06-01T24:00', 'not-a-date', ''])(
        'gives an Invalid Date for %p',
        (value) => {
          expect(Number.isNaN(parseParisDateTimeLocal(value).getTime())).toBe(true);
        }
      );

      it('reads back what formatParisDateTimeLocal renders', () => {
        const stored = new Date('2026-06-01T10:30:00Z');
        expect(parseParisDateTimeLocal(formatParisDateTimeLocal(stored))).toEqual(stored);
      });
    });
  }
);

// With JavaScript, a browser in Paris parses the value with `new Date`
// (localInputToIso) and posts that instant. Without JavaScript the server
// must store the same one, including on both change nights.
describe('parseParisDateTimeLocal against a browser in Paris', () => {
  pinHostZone('Europe/Paris');

  it.each(['2026-03-29', '2026-10-25', '2026-06-01'])('agrees every minute of %s', (day) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const disagreements: string[] = [];
    for (let minute = 0; minute < 24 * 60; minute++) {
      const value = `${day}T${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
      if (parseParisDateTimeLocal(value).getTime() !== new Date(value).getTime()) {
        disagreements.push(value);
      }
    }
    expect(disagreements).toEqual([]);
  });
});

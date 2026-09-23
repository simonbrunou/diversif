import { describe, expect, it } from 'bun:test';
import { PARIS_TIME_ZONE, parisDateParts, parisDayIndex, latestParisWallClock } from './paris-date';

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

describe('parisDayIndex', () => {
  it('advances only once Paris crosses midnight, not UTC', () => {
    const beforeParisMidnight = parisDayIndex(Date.parse('2026-06-01T21:59:00Z'));
    const afterParisMidnight = parisDayIndex(Date.parse('2026-06-01T22:01:00Z'));
    expect(afterParisMidnight).toBe(beforeParisMidnight + 1);
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

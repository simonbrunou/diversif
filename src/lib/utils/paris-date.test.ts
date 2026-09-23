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
});

import { describe, expect, it } from 'bun:test';
import { mealDateError } from './meal-date';

describe('mealDateError', () => {
  const now = new Date('2024-06-15T12:00:00Z').getTime();

  it('accepts a meal dated now', () => {
    expect(mealDateError(new Date(now), '2024-01-01', now)).toBeNull();
  });

  it('accepts a meal within the 5-minute clock-skew tolerance', () => {
    const givenAt = new Date(now + 4 * 60 * 1000);
    expect(mealDateError(givenAt, '2024-01-01', now)).toBeNull();
  });

  it('rejects a meal more than 5 minutes in the future', () => {
    const givenAt = new Date(now + 6 * 60 * 1000);
    expect(mealDateError(givenAt, '2024-01-01', now)).toBe('errorsLogDateFuture');
  });

  it('rejects a meal dated before the child was born', () => {
    const givenAt = new Date('2023-12-31T12:00:00Z');
    expect(mealDateError(givenAt, '2024-01-01', now)).toBe('errorsLogDateBeforeBirth');
  });

  it('accepts a meal logged on the child’s birth day itself', () => {
    // 2024-01-01T12:00:00Z is 13:00 CET in Paris — still 1 January there,
    // unlike a near-midnight instant that could roll into 2 January.
    const givenAt = new Date('2024-01-01T12:00:00Z');
    expect(mealDateError(givenAt, '2024-01-01', now)).toBeNull();
  });

  it('uses the Europe/Paris civil day, not UTC, near midnight', () => {
    // 2026-06-01T22:30:00Z is already 2026-06-02T00:30:00+02:00 (CEST) in
    // Paris, so it must NOT be rejected as before a 2026-06-02 birth.
    const givenAt = new Date('2026-06-01T22:30:00Z');
    const laterNow = new Date('2026-06-02T00:00:00Z').getTime();
    expect(mealDateError(givenAt, '2026-06-02', laterNow)).toBeNull();
  });

  it('still rejects a meal the Paris civil day before birth, even close to midnight', () => {
    // 2026-06-01T20:30:00Z is still 2026-06-01 in Paris (22:30 CEST) — one
    // civil day before a 2026-06-02 birth.
    const givenAt = new Date('2026-06-01T20:30:00Z');
    const laterNow = new Date('2026-06-02T00:00:00Z').getTime();
    expect(mealDateError(givenAt, '2026-06-02', laterNow)).toBe('errorsLogDateBeforeBirth');
  });
});

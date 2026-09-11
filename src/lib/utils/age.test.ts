import { describe, expect, it } from 'bun:test';
import { ageInMonths, formatAge } from './age';

describe('ageInMonths', () => {
  it('returns 0 for same day', () => {
    expect(ageInMonths('2024-05-03', new Date('2024-05-03T12:00:00Z'))).toBe(0);
  });
  it('counts complete months', () => {
    expect(ageInMonths('2024-05-03', new Date('2024-08-03T00:00:00Z'))).toBe(3);
  });
  it('subtracts one month if day not yet reached', () => {
    expect(ageInMonths('2024-05-15', new Date('2024-08-10T00:00:00Z'))).toBe(2);
  });
  it('handles year wrap', () => {
    expect(ageInMonths('2023-11-10', new Date('2024-05-10T00:00:00Z'))).toBe(6);
  });
  it('clamps negative ages to 0', () => {
    expect(ageInMonths('2024-05-03', new Date('2024-04-30T00:00:00Z'))).toBe(0);
  });
  it('uses the Europe/Paris civil day, not UTC, near midnight', () => {
    // 2026-01-10T00:30:00+01:00 (CET) == 2026-01-09T23:30:00Z: already
    // local-Jan-10 in Paris (6-month birthday), but still UTC-Jan-9.
    const now = new Date(Date.UTC(2026, 0, 9, 23, 30, 0));
    expect(ageInMonths('2025-07-10', now)).toBe(6);
  });
});

describe('formatAge', () => {
  it('returns "à venir" when birth is in the future', () => {
    expect(formatAge('2030-01-01', new Date('2024-01-01T00:00:00Z'))).toBe('à venir');
  });
  it('returns "aujourd’hui" on the day of birth', () => {
    expect(formatAge('2024-05-03', new Date('2024-05-03T00:00:00Z'))).toBe('aujourd’hui');
  });
  it('returns "1 jour" the day after birth', () => {
    expect(formatAge('2024-05-03', new Date('2024-05-04T00:00:00Z'))).toBe('1 jour');
  });
  it('returns days when under a month', () => {
    expect(formatAge('2024-05-01', new Date('2024-05-15T12:00:00Z'))).toBe('14 jours');
  });
  it('returns months and days', () => {
    const out = formatAge('2024-01-01', new Date('2024-08-13T00:00:00Z'));
    expect(out).toMatch(/7 mois et 12 jours/);
  });
  it('returns months alone when on the day boundary', () => {
    expect(formatAge('2024-01-01', new Date('2024-08-01T00:00:00Z'))).toBe('7 mois');
  });
  it('handles single-month case', () => {
    expect(formatAge('2024-01-01', new Date('2024-02-15T00:00:00Z'))).toBe('1 mois et 14 jours');
  });
  it('returns "X mois et 1 jour" with singular', () => {
    expect(formatAge('2024-01-01', new Date('2024-08-02T00:00:00Z'))).toBe('7 mois et 1 jour');
  });
  it('returns whole-year output when months is a multiple of 12', () => {
    expect(formatAge('2022-05-03', new Date('2024-05-03T12:00:00Z'))).toBe('2 ans');
  });
  it('returns "X ans et Y mois" when not a whole year', () => {
    expect(formatAge('2022-01-01', new Date('2024-05-03T00:00:00Z'))).toBe('2 ans et 4 mois');
  });
  it('does not go negative when the birthday falls right after Paris midnight', () => {
    // 2026-01-10T00:30:00+01:00 (CET) == 2026-01-09T23:30:00Z: the child's
    // 6-month birthday has already arrived by the Paris calendar, but the
    // instant is still UTC-Jan-9. Mixing a UTC day cursor with a
    // Paris-anchored month count must not produce "6 mois et -1 jours".
    const now = new Date(Date.UTC(2026, 0, 9, 23, 30, 0));
    expect(formatAge('2025-07-10', now)).toBe('6 mois');
  });
  it('treats the birth date as arrived once the Paris civil day matches, not the UTC day', () => {
    // 2026-01-10T00:30:00+01:00 (CET) == 2026-01-09T23:30:00Z: born "today"
    // by the parent's Paris calendar, still UTC-Jan-9.
    const now = new Date(Date.UTC(2026, 0, 9, 23, 30, 0));
    expect(formatAge('2026-01-10', now)).toBe('aujourd’hui');
  });
});

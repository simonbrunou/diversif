import { describe, it, expect } from 'vitest';
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
});

describe('formatAge', () => {
  it('returns days when under a month', () => {
    expect(formatAge('2024-05-01', new Date('2024-05-15T12:00:00Z'))).toBe('14 jours');
  });
  it('returns months and days', () => {
    const out = formatAge('2024-01-01', new Date('2024-08-13T00:00:00Z'));
    expect(out).toMatch(/7 mois et 12 jours/);
  });
  it('handles whole-year output', () => {
    expect(formatAge('2022-05-03', new Date('2024-05-03T12:00:00Z'))).toBe('2 ans');
  });
});

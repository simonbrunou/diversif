import { describe, it, expect } from 'vitest';
import { isValidBirthDate } from './dates';

describe('isValidBirthDate', () => {
  it('accepts real ISO dates', () => {
    expect(isValidBirthDate('2024-10-01')).toBe(true);
    expect(isValidBirthDate('2024-02-29')).toBe(true); // leap year
  });
  it('rejects malformed shapes', () => {
    expect(isValidBirthDate('2024-1-1')).toBe(false);
    expect(isValidBirthDate('24-10-01')).toBe(false);
    expect(isValidBirthDate('2024/10/01')).toBe(false);
    expect(isValidBirthDate('')).toBe(false);
  });
  it('rejects impossible months/days', () => {
    expect(isValidBirthDate('2026-99-99')).toBe(false);
    expect(isValidBirthDate('2024-13-01')).toBe(false);
    expect(isValidBirthDate('2024-02-30')).toBe(false);
    expect(isValidBirthDate('2023-02-29')).toBe(false); // non-leap
  });
});

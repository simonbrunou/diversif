import { describe, it, expect, afterEach } from 'vitest';
import { setLanguageTag, sourceLanguageTag } from '$lib/paraglide/runtime';
import {
  formatRelative,
  formatDateTime,
  formatDateInputValue,
  parseDateTimeLocal,
  isValidBirthDate
} from './dates';

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

describe('formatRelative', () => {
  // Pick a "now" comfortably inside the day so same-day comparisons survive
  // local-timezone shifts on CI machines.
  const now = new Date('2026-05-03T20:00:00Z');

  it('returns "à l’instant" for sub-minute differences', () => {
    expect(formatRelative(now.getTime() - 5_000, now)).toBe('à l’instant');
  });

  it('returns minutes for < 1 hour', () => {
    expect(formatRelative(now.getTime() - 5 * 60_000, now)).toBe('il y a 5 min');
  });

  it('returns hours for same-day < 12h', () => {
    expect(formatRelative(now.getTime() - 3 * 3_600_000, now)).toBe('il y a 3 h');
  });

  it('returns "aujourd’hui HH:mm" later same day (>= 12h same-day)', () => {
    const earlySameDay = new Date('2026-05-03T01:00:00Z');
    const out = formatRelative(earlySameDay, now);
    expect(out.startsWith('aujourd’hui ')).toBe(true);
  });

  it('returns "hier HH:mm" for the previous calendar day', () => {
    const yesterday = new Date('2026-05-02T18:00:00Z');
    expect(formatRelative(yesterday, now).startsWith('hier ')).toBe(true);
  });

  it('returns short same-year format', () => {
    const earlier = new Date('2026-01-15T09:00:00Z');
    const out = formatRelative(earlier, now);
    expect(out).not.toMatch(/aujourd’hui|hier|il y a/);
    expect(out).not.toMatch(/\d{4}/); // year omitted for same-year
  });

  it('returns full date for different years', () => {
    const old = new Date('2024-03-01T09:00:00Z');
    expect(formatRelative(old, now)).toMatch(/2024/);
  });

  describe('locale switching', () => {
    afterEach(() => {
      setLanguageTag(sourceLanguageTag);
    });

    it('returns English strings when paraglide locale is en', () => {
      setLanguageTag('en');
      expect(formatRelative(now.getTime() - 5_000, now)).toBe('just now');
      expect(formatRelative(now.getTime() - 5 * 60_000, now)).toBe('5 min ago');
      expect(formatRelative(now.getTime() - 3 * 3_600_000, now)).toBe('3 h ago');

      const earlySameDay = new Date('2026-05-03T01:00:00Z');
      expect(formatRelative(earlySameDay, now).startsWith('today ')).toBe(true);

      const yesterday = new Date('2026-05-02T18:00:00Z');
      expect(formatRelative(yesterday, now).startsWith('yesterday ')).toBe(true);
    });

    it('renders dayjs month names in English when locale is en', () => {
      setLanguageTag('en');
      // March '24 is "Mar" in English vs "mars" in French
      expect(formatDateTime(new Date('2024-03-01T09:30:00Z'))).toMatch(/Mar/);
    });
  });
});

describe('formatDateTime', () => {
  it('formats a date with year', () => {
    const out = formatDateTime(new Date('2024-03-01T09:30:00Z'));
    expect(out).toMatch(/2024/);
    expect(out).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatDateInputValue', () => {
  it('returns a value compatible with <input type="datetime-local">', () => {
    const out = formatDateInputValue(new Date('2024-03-01T09:30:00Z'));
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('defaults to "now" when no argument is provided', () => {
    expect(formatDateInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('parseDateTimeLocal', () => {
  it('round-trips a local datetime string into a Date', () => {
    const d = parseDateTimeLocal('2024-03-01T09:30');
    expect(d).toBeInstanceOf(Date);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});

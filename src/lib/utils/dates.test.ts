import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import {
  formatRelative,
  formatDateInputValue,
  isValidBirthDate,
  localInputToIso,
  formatDate,
  formatTime,
  toEpochMs
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

  // The server renders the feed in UTC and the browser in its own zone; both
  // must print what a parent in Paris reads on the clock.
  describe.each(['UTC', 'Europe/Paris', 'America/Montreal', 'Asia/Tokyo'])(
    'in Paris time, on a host in %s',
    (zone) => {
      const halfPastMidnight = new Date('2026-06-01T22:30:00Z'); // 00:30 Paris, 2 June
      let hostZone: string | undefined;

      beforeEach(() => {
        hostZone = process.env.TZ;
        process.env.TZ = zone;
      });

      afterEach(() => {
        if (hostZone === undefined) delete process.env.TZ;
        else process.env.TZ = hostZone;
      });

      it('turns over at Paris midnight: 22:00 the evening before is « hier »', () => {
        expect(formatRelative(Date.parse('2026-06-01T20:00:00Z'), halfPastMidnight)).toBe(
          'hier 22:00'
        );
      });

      it('prints the Paris hour for today', () => {
        const onePm = new Date('2026-06-02T11:00:00Z'); // 13:00 Paris, 12 h 50 after 00:10
        expect(formatRelative(Date.parse('2026-06-01T22:10:00Z'), onePm)).toBe('aujourd’hui 00:10');
      });

      it('prints the Paris date and weekday for an older entry', () => {
        // 23:30Z on Thursday 15 January is 00:30 CET on Friday 16 January.
        expect(formatRelative(Date.parse('2026-01-15T23:30:00Z'), halfPastMidnight)).toBe(
          'ven. 16 janv. 00:30'
        );
      });

      it('reads the year in Paris: 23:30 Paris on 31 December is last year', () => {
        const newYear = new Date('2026-01-02T10:00:00Z');
        expect(formatRelative(Date.parse('2025-12-31T22:30:00Z'), newYear)).toBe(
          '31 déc. 2025 23:30'
        );
      });
    }
  );

  describe('locale switching', () => {
    afterEach(() => {
      overwriteGetLocale(() => baseLocale);
    });

    it('returns English strings when paraglide locale is en', () => {
      overwriteGetLocale(() => 'en');
      expect(formatRelative(now.getTime() - 5_000, now)).toBe('just now');
      expect(formatRelative(now.getTime() - 5 * 60_000, now)).toBe('5 min ago');
      expect(formatRelative(now.getTime() - 3 * 3_600_000, now)).toBe('3 h ago');

      const earlySameDay = new Date('2026-05-03T01:00:00Z');
      expect(formatRelative(earlySameDay, now).startsWith('today ')).toBe(true);

      const yesterday = new Date('2026-05-02T18:00:00Z');
      expect(formatRelative(yesterday, now).startsWith('yesterday ')).toBe(true);
    });
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

  // The browser renders a repas form in its own zone, the one localInputToIso
  // converts from, so a parent outside France keeps their local time. The
  // server renders Paris time with formatParisDateTimeLocal instead (#485).
  describe.each([
    ['UTC', '2026-06-01T10:00'],
    ['Europe/Paris', '2026-06-01T12:00'],
    ['Asia/Tokyo', '2026-06-01T19:00']
  ])('on a host in %s', (zone, value) => {
    let hostZone: string | undefined;

    beforeEach(() => {
      hostZone = process.env.TZ;
      process.env.TZ = zone;
    });

    afterEach(() => {
      if (hostZone === undefined) delete process.env.TZ;
      else process.env.TZ = hostZone;
    });

    it(`gives ${value} for 2026-06-01T10:00:00Z, read on the host's clock`, () => {
      expect(formatDateInputValue(new Date('2026-06-01T10:00:00Z'))).toBe(value);
    });
  });
});

describe('localInputToIso', () => {
  it('passes through values that already carry a timezone offset', () => {
    expect(localInputToIso('2026-05-17T10:27:00Z')).toBe('2026-05-17T10:27:00Z');
    expect(localInputToIso('2026-05-17T12:27:00+02:00')).toBe('2026-05-17T12:27:00+02:00');
    expect(localInputToIso('2026-05-17T08:27:00-02:00')).toBe('2026-05-17T08:27:00-02:00');
  });

  it('anchors a TZ-naive datetime-local string to the same instant', () => {
    // Naive strings round-trip through Date in host-local time. The helper's
    // contract is "preserve the instant" — re-parsing the output yields the
    // same moment as parsing the input.
    const naive = '2026-05-17T12:27';
    const isoOut = localInputToIso(naive);
    expect(/Z|[+-]\d{2}:\d{2}$/.test(isoOut)).toBe(true);
    expect(new Date(isoOut).getTime()).toBe(new Date(naive).getTime());
  });

  it('returns the input unchanged for invalid strings', () => {
    expect(localInputToIso('not-a-date')).toBe('not-a-date');
    expect(localInputToIso('')).toBe('');
  });
});

describe('formatDate', () => {
  const d = new Date('2026-03-01T12:00:00Z');

  it('formats a Date object with French locale', () => {
    const out = formatDate(d, 'fr-FR');
    // "medium" dateStyle in fr-FR → "1 mars 2026"
    expect(out).toMatch(/mars/i);
    expect(out).toMatch(/2026/);
  });

  it('formats a Date object with English locale', () => {
    const out = formatDate(d, 'en-GB');
    expect(out).toMatch(/Mar/i);
    expect(out).toMatch(/2026/);
  });

  it('accepts an epoch ms number', () => {
    const out = formatDate(d.getTime(), 'fr-FR');
    expect(out).toMatch(/2026/);
  });

  it('accepts an ISO string', () => {
    const out = formatDate('2026-03-01T12:00:00Z', 'fr-FR');
    expect(out).toMatch(/2026/);
  });

  it('omits the year when style="short"', () => {
    const out = formatDate(d, 'fr-FR', { style: 'short' });
    expect(out).toMatch(/mars/i);
    expect(out).not.toMatch(/2026/);
  });

  it('anchors on the given IANA zone regardless of host TZ when timeZone is provided', () => {
    // 2026-03-01T23:30:00Z is 2026-03-02T00:30 in Europe/Paris (CET, +1h) —
    // a different calendar day than the UTC instant.
    const late = new Date('2026-03-01T23:30:00Z');
    const out = formatDate(late, 'fr-FR', { style: 'short', timeZone: 'Europe/Paris' });
    expect(out).toMatch(/2 mars/i);
  });
});

describe('formatTime', () => {
  it('returns a non-empty time string with digit separators', () => {
    const d = new Date('2026-03-01T14:27:00Z');
    const out = formatTime(d, 'fr-FR');
    // timeStyle:'short' in fr-FR produces something like "14:27" or "15:27"
    // depending on the host timezone. Just confirm it's a time-shaped string.
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    // Must contain exactly the minutes component ":27" or " 27"
    expect(out).toMatch(/27/);
  });

  it('anchors on the given IANA zone regardless of host TZ when timeZone is provided', () => {
    // 23:30 UTC is 00:30 the next day in Europe/Paris (CET, +1h).
    const d = new Date('2026-03-01T23:30:00Z');
    const out = formatTime(d, 'fr-FR', { timeZone: 'Europe/Paris' });
    expect(out).toMatch(/00:30|0:30/);
  });

  it('accepts an epoch ms number', () => {
    const d = new Date('2026-03-01T09:05:00Z');
    const out = formatTime(d.getTime(), 'en-GB');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('toEpochMs', () => {
  const d = new Date('2026-01-15T08:00:00Z');

  it('returns getTime() for a Date', () => {
    expect(toEpochMs(d)).toBe(d.getTime());
  });

  it('passes through a number unchanged', () => {
    expect(toEpochMs(1234567890)).toBe(1234567890);
  });

  it('parses an ISO string to epoch ms', () => {
    expect(toEpochMs('2026-01-15T08:00:00Z')).toBe(d.getTime());
  });
});

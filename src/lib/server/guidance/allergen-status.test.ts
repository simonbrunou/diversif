import { describe, expect, it } from 'bun:test';
import { summarizeAllergenRows, type AllergenRow } from './allergen-status';

describe('summarizeAllergenRows lastTried formatting', () => {
  it('formats the Europe/Paris civil day, not UTC, for a just-after-midnight entry', () => {
    // 2026-01-10T00:20:00+01:00 (CET, winter) == 2026-01-09T23:20:00Z: the
    // parent logged this "today" (10/01) by their own local clock, but the
    // instant is still UTC-Jan-9.
    const givenAt = new Date(Date.UTC(2026, 0, 9, 23, 20, 0));
    const rows: AllergenRow[] = [{ allergenType: 'arachide', givenAt, reaction: 'ras' }];

    const [item] = summarizeAllergenRows(rows, givenAt).filter((i) => i.id === 'arachide');
    expect(item.lastTried).toBe('10/01/26');
  });
});

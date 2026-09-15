import { describe, expect, it } from 'bun:test';
import { summarizeAllergenRows, type AllergenRow } from './allergen-status';

describe('summarizeAllergenRows lastTried formatting', () => {
  it('formats the Europe/Paris civil day, not UTC, for a just-after-midnight entry', () => {
    // 2026-01-10T00:20:00+01:00 (CET, winter) == 2026-01-09T23:20:00Z: the
    // parent logged this "today" (10/01) by their own local clock, but the
    // instant is still UTC-Jan-9.
    const givenAt = new Date(Date.UTC(2026, 0, 9, 23, 20, 0));
    const rows: AllergenRow[] = [
      { entryId: 1, allergenType: 'arachide', givenAt, reaction: 'ras' }
    ];

    const [item] = summarizeAllergenRows(rows, givenAt).filter((i) => i.id === 'arachide');
    expect(item.lastTried).toBe('10/01/26');
  });
});

describe('summarizeAllergenRows worstEntryId', () => {
  // All rows sit in January 2026; NOW is the 28th so every fixture is well
  // past ALLERGEN_MAINTAIN_DAYS and the state ladder is exercised on purpose.
  const jan = (day: number) => new Date(Date.UTC(2026, 0, day, 12, 0, 0));
  const NOW = jan(28);

  it('points at the reaction entry even when a later log went fine', () => {
    const rows: AllergenRow[] = [
      { entryId: 10, allergenType: 'sesame', givenAt: jan(1), reaction: 'ras' },
      { entryId: 11, allergenType: 'sesame', givenAt: jan(2), reaction: 'reaction' },
      { entryId: 12, allergenType: 'sesame', givenAt: jan(3), reaction: 'ras' }
    ];
    const item = summarizeAllergenRows(rows, NOW).find((i) => i.id === 'sesame')!;
    expect(item.state).toBe('reaction');
    expect(item.worstEntryId).toBe(11);
  });

  it('prefers a reaction over a later inconfort rather than the most recent non-RAS', () => {
    const rows: AllergenRow[] = [
      { entryId: 20, allergenType: 'oeuf', givenAt: jan(5), reaction: 'reaction' },
      { entryId: 21, allergenType: 'oeuf', givenAt: jan(9), reaction: 'inconfort' }
    ];
    const item = summarizeAllergenRows(rows, NOW).find((i) => i.id === 'oeuf')!;
    expect(item.worstEntryId).toBe(20);
  });

  it('breaks a same-severity tie with the most recent entry', () => {
    const rows: AllergenRow[] = [
      { entryId: 30, allergenType: 'lait', givenAt: jan(4), reaction: 'inconfort' },
      { entryId: 31, allergenType: 'lait', givenAt: jan(8), reaction: 'inconfort' }
    ];
    const item = summarizeAllergenRows(rows, NOW).find((i) => i.id === 'lait')!;
    expect(item.worstEntryId).toBe(31);
  });

  it('is null when nothing has gone wrong, so no pill offers a dead link', () => {
    const rows: AllergenRow[] = [
      { entryId: 40, allergenType: 'gluten', givenAt: jan(27), reaction: 'ras' }
    ];
    const items = summarizeAllergenRows(rows, NOW);
    expect(items.find((i) => i.id === 'gluten')!.worstEntryId).toBeNull();
    const untried = items.find((i) => i.id === 'poisson')!;
    expect(untried.state).toBe('todo');
    expect(untried.worstEntryId).toBeNull();
  });
});

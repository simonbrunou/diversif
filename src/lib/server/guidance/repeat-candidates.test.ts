import { describe, expect, it } from 'bun:test';
import { findRepeatCandidates } from './repeat-candidates';
import type { EnrichedEntry } from './queries';
import type { AllergenId } from '$lib/utils/allergens';

const NOW = new Date('2026-05-19T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function entry(overrides: Partial<EnrichedEntry> = {}): EnrichedEntry {
  return {
    id: 1,
    foodId: 1,
    foodName: 'Carotte',
    category: 'legumes',
    allergenType: null,
    reaction: 'ras',
    givenAt: NOW - DAY,
    ...overrides
  };
}

describe('findRepeatCandidates', () => {
  it('returns only foods given 1-2× with no symptoms by default', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, foodName: 'Carotte', reaction: 'ras' }),
        entry({ foodId: 2, foodName: 'Courgette', reaction: 'ras' }),
        entry({ foodId: 2, foodName: 'Courgette', reaction: 'inconfort' })
      ],
      { now: NOW }
    );
    expect(out.map((c) => c.foodId)).toEqual([1]);
  });

  it('excludes an aggregated food if any exposure had discomfort', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, reaction: 'ras', givenAt: NOW - 5 * DAY }),
        entry({ foodId: 1, reaction: 'inconfort', givenAt: NOW - 2 * DAY })
      ],
      { now: NOW }
    );
    expect(out).toEqual([]);
  });

  it('excludes foods given more than maxCount times', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, reaction: 'ras' }),
        entry({ foodId: 1, reaction: 'ras' }),
        entry({ foodId: 1, reaction: 'ras' })
      ],
      { now: NOW }
    );
    expect(out).toEqual([]);
  });

  it('excludes foods whose worst reaction exceeds maxWorstRank', () => {
    const out = findRepeatCandidates(
      [entry({ foodId: 1, reaction: 'ras' }), entry({ foodId: 1, reaction: 'reaction' })],
      { now: NOW }
    );
    expect(out).toEqual([]);
  });

  it('respects custom maxCount (used by reminders rule 6)', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, reaction: 'ras' }),
        entry({ foodId: 2, reaction: 'ras' }),
        entry({ foodId: 2, reaction: 'ras' })
      ],
      { maxCount: 1, now: NOW }
    );
    expect(out.map((c) => c.foodId)).toEqual([1]);
  });

  it('excludes foods last given within minDaysSinceLastGiven', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, foodName: 'fresh', givenAt: NOW - 1 * DAY }),
        entry({ foodId: 2, foodName: 'stale', givenAt: NOW - 10 * DAY })
      ],
      { minDaysSinceLastGiven: 3, now: NOW }
    );
    expect(out.map((c) => c.foodId)).toEqual([2]);
  });

  it('treats lastGivenAt boundary as exclusive (<= minDays excluded)', () => {
    const out = findRepeatCandidates([entry({ foodId: 1, givenAt: NOW - 3 * DAY })], {
      minDaysSinceLastGiven: 3,
      now: NOW
    });
    expect(out).toEqual([]);
  });

  it('excludes foods whose allergenType is in excludeAllergens', () => {
    const out = findRepeatCandidates(
      [
        entry({ foodId: 1, foodName: 'œuf', allergenType: 'oeuf' }),
        entry({ foodId: 2, foodName: 'carotte', allergenType: null }),
        entry({ foodId: 3, foodName: 'lentilles', allergenType: 'lait' })
      ],
      { excludeAllergens: new Set<AllergenId>(['oeuf']), now: NOW }
    );
    expect(out.map((c) => c.foodId).sort()).toEqual([2, 3]);
  });

  it('keeps foods with null allergenType even when exclusion set is non-empty', () => {
    const out = findRepeatCandidates([entry({ foodId: 1, allergenType: null })], {
      excludeAllergens: new Set<AllergenId>(['oeuf']),
      now: NOW
    });
    expect(out.map((c) => c.foodId)).toEqual([1]);
  });

  it('returns lastGivenAt as the most recent exposure regardless of input order', () => {
    const out = findRepeatCandidates(
      [entry({ foodId: 1, givenAt: NOW - 1 * DAY }), entry({ foodId: 1, givenAt: NOW - 5 * DAY })],
      { now: NOW }
    );
    expect(out[0].lastGivenAt).toBe(NOW - 1 * DAY);
  });

  it('returns an empty array for empty input', () => {
    expect(findRepeatCandidates([], { now: NOW })).toEqual([]);
  });

  it('defaults `now` to Date.now() when omitted', () => {
    const realNow = Date.now();
    const out = findRepeatCandidates([entry({ foodId: 1, givenAt: realNow - 10 * DAY })], {
      minDaysSinceLastGiven: 3
    });
    expect(out.map((c) => c.foodId)).toEqual([1]);
  });
});

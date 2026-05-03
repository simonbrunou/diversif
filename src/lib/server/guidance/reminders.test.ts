import { describe, it, expect } from 'vitest';
import { computeReminders, type ReminderInput } from './reminders';
import type { EnrichedEntry } from './queries';
import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';

const NOW = new Date('2026-05-03T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const ALL_ALLERGENS = new Set<AllergenId>(ALLERGENS.map((a) => a.id));

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

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    childId: 1,
    ageMonths: 8, // outside stage-transition windows (6-7, 9-10, 12-13)
    childCreatedAt: NOW - 30 * DAY,
    entries: [],
    introducedAllergens: new Set<AllergenId>(),
    dismissals: new Set<string>(),
    now: NOW,
    ...overrides
  };
}

/** Helper for tests that should isolate one rule: suppress all unrelated rules. */
function isolated(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return input({ introducedAllergens: ALL_ALLERGENS, ...overrides });
}

describe('computeReminders', () => {
  describe('welcome', () => {
    it('fires when child < 7 days old and 0 entries', () => {
      const out = computeReminders(input({ childCreatedAt: NOW - 2 * DAY, entries: [] }));
      expect(out.find((r) => r.key === 'welcome')).toBeDefined();
    });

    it('does not fire when child has entries', () => {
      const out = computeReminders(input({ childCreatedAt: NOW - 2 * DAY, entries: [entry()] }));
      expect(out.find((r) => r.key === 'welcome')).toBeUndefined();
    });

    it('does not fire when child is older than 7 days', () => {
      const out = computeReminders(input({ childCreatedAt: NOW - 8 * DAY, entries: [] }));
      expect(out.find((r) => r.key === 'welcome')).toBeUndefined();
    });
  });

  describe('stage transitions', () => {
    it('fires at 6 months', () => {
      const out = computeReminders(input({ ageMonths: 6 }));
      expect(out.find((r) => r.key === 'stage-transition:6m')).toBeDefined();
    });

    it('fires at 9 months', () => {
      const out = computeReminders(input({ ageMonths: 9 }));
      expect(out.find((r) => r.key === 'stage-transition:9m')).toBeDefined();
    });

    it('fires at 12 months', () => {
      const out = computeReminders(input({ ageMonths: 12 }));
      expect(out.find((r) => r.key === 'stage-transition:12m')).toBeDefined();
    });

    it('does not fire before its window', () => {
      const out = computeReminders(input({ ageMonths: 5 }));
      expect(out.find((r) => r.key === 'stage-transition:6m')).toBeUndefined();
    });
  });

  describe('stale-diversity', () => {
    it('fires when no new food in 14+ days', () => {
      const e = entry({ givenAt: NOW - 20 * DAY });
      const out = computeReminders(isolated({ entries: [e] }));
      expect(out.find((r) => r.key === 'stale-diversity')).toBeDefined();
    });

    it('does not fire when last new food is recent', () => {
      const out = computeReminders(isolated({ entries: [entry({ givenAt: NOW - 3 * DAY })] }));
      expect(out.find((r) => r.key === 'stale-diversity')).toBeUndefined();
    });

    it('does not fire when entries empty', () => {
      const out = computeReminders(isolated({ entries: [] }));
      expect(out.find((r) => r.key === 'stale-diversity')).toBeUndefined();
    });
  });

  describe('pending-allergen', () => {
    it('emits warn-level reminders for missing priority allergens at age >= 6 mo', () => {
      const out = computeReminders(input({ ageMonths: 7, introducedAllergens: new Set() }));
      const pending = out.filter((r) => r.key.startsWith('pending-allergen:'));
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].severity).toBe('warn');
    });

    it('caps at top 3', () => {
      const out = computeReminders(input({ ageMonths: 7 }));
      const pending = out.filter((r) => r.key.startsWith('pending-allergen:'));
      expect(pending.length).toBeLessThanOrEqual(3);
    });

    it('does not emit before 6 months', () => {
      const out = computeReminders(input({ ageMonths: 5 }));
      expect(out.find((r) => r.key.startsWith('pending-allergen:'))).toBeUndefined();
    });

    it('skips already-introduced allergens', () => {
      const out = computeReminders(
        input({
          ageMonths: 7,
          introducedAllergens: new Set<AllergenId>(['oeuf', 'arachide', 'lait'])
        })
      );
      expect(out.find((r) => r.key === 'pending-allergen:oeuf')).toBeUndefined();
    });
  });

  describe('high-risk-window', () => {
    it('fires at 4-11 mo with no allergen introduced and entries present', () => {
      const out = computeReminders(input({ ageMonths: 5, entries: [entry()] }));
      expect(out.find((r) => r.key === 'high-risk-window')).toBeDefined();
    });

    it('does not fire when an allergen was introduced', () => {
      const out = computeReminders(
        input({
          ageMonths: 5,
          entries: [entry()],
          introducedAllergens: new Set<AllergenId>(['oeuf'])
        })
      );
      expect(out.find((r) => r.key === 'high-risk-window')).toBeUndefined();
    });
  });

  describe('repeat-exposure', () => {
    it('fires for foods given once with reaction <= inconfort, > 3 days ago', () => {
      const e = entry({ foodId: 42, foodName: 'Brocoli', givenAt: NOW - 5 * DAY });
      const out = computeReminders(isolated({ entries: [e] }));
      const r = out.find((x) => x.key === 'repeat-exposure:42');
      expect(r).toBeDefined();
      expect(r?.title).toContain('Brocoli');
    });

    it('does not fire for foods given more than once', () => {
      const e1 = entry({ foodId: 42, givenAt: NOW - 5 * DAY });
      const e2 = entry({ id: 2, foodId: 42, givenAt: NOW - 3 * DAY });
      const out = computeReminders(isolated({ entries: [e1, e2] }));
      expect(out.find((r) => r.key === 'repeat-exposure:42')).toBeUndefined();
    });

    it('does not fire for foods with a true reaction', () => {
      const e = entry({ foodId: 42, reaction: 'reaction', givenAt: NOW - 5 * DAY });
      const out = computeReminders(isolated({ entries: [e] }));
      expect(out.find((r) => r.key === 'repeat-exposure:42')).toBeUndefined();
    });

    it('does not fire if given less than 3 days ago', () => {
      const e = entry({ foodId: 42, givenAt: NOW - 2 * DAY });
      const out = computeReminders(isolated({ entries: [e] }));
      expect(out.find((r) => r.key === 'repeat-exposure:42')).toBeUndefined();
    });
  });

  describe('category-imbalance', () => {
    it('fires when one category > 60% of last 14 days', () => {
      const entries: EnrichedEntry[] = [];
      for (let i = 0; i < 5; i++) {
        // Same foodId (1) repeated so repeat-exposure does not fire
        entries.push(entry({ id: i, foodId: 1, category: 'legumes', givenAt: NOW - i * DAY }));
      }
      entries.push(entry({ id: 6, foodId: 1, category: 'fruits', givenAt: NOW - 6 * DAY }));
      const out = computeReminders(isolated({ entries }));
      expect(out.find((r) => r.key.startsWith('category-imbalance:'))).toBeDefined();
    });

    it('does not fire when balanced', () => {
      const entries: EnrichedEntry[] = [
        entry({ id: 1, foodId: 1, category: 'legumes', givenAt: NOW - 1 * DAY }),
        entry({ id: 2, foodId: 1, category: 'fruits', givenAt: NOW - 2 * DAY }),
        entry({ id: 3, foodId: 1, category: 'feculents', givenAt: NOW - 3 * DAY }),
        entry({ id: 4, foodId: 1, category: 'viandes', givenAt: NOW - 4 * DAY }),
        entry({ id: 5, foodId: 1, category: 'oeufs', givenAt: NOW - 5 * DAY })
      ];
      const out = computeReminders(isolated({ entries }));
      expect(out.find((r) => r.key.startsWith('category-imbalance:'))).toBeUndefined();
    });
  });

  describe('forbidden-reminder', () => {
    it('fires when honey is logged before 12 mo', () => {
      const e = entry({ foodName: 'Miel de lavande' });
      const out = computeReminders(input({ ageMonths: 8, entries: [e] }));
      expect(out.find((r) => r.key === 'forbidden-reminder:miel')).toBeDefined();
    });

    it('does not fire after 12 mo', () => {
      const e = entry({ foodName: 'Miel de lavande' });
      const out = computeReminders(input({ ageMonths: 14, entries: [e] }));
      expect(out.find((r) => r.key === 'forbidden-reminder:miel')).toBeUndefined();
    });
  });

  describe('dismissals & ordering', () => {
    it('honors dismissals', () => {
      const out = computeReminders(
        input({
          childCreatedAt: NOW - 2 * DAY,
          entries: [],
          dismissals: new Set(['welcome'])
        })
      );
      expect(out.find((r) => r.key === 'welcome')).toBeUndefined();
    });

    it('returns at most 4 reminders', () => {
      const out = computeReminders(input({ ageMonths: 7 }));
      expect(out.length).toBeLessThanOrEqual(4);
    });

    it('orders important > warn > info', () => {
      const out = computeReminders(
        input({ ageMonths: 6, entries: [entry({ givenAt: NOW - 20 * DAY })] })
      );
      for (let i = 1; i < out.length; i++) {
        const order = { important: 0, warn: 1, info: 2 } as const;
        expect(order[out[i].severity]).toBeGreaterThanOrEqual(order[out[i - 1].severity]);
      }
    });
  });
});

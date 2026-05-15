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

    it('uses earliest occurrence per food as the first-intro timestamp', () => {
      // Same food (id=1) introduced 200 d ago, re-logged 2 d ago. The food is
      // not new : stale-diversity must look at the earliest log per food, not
      // the latest, so the newest *first* intro across all foods is 200 d.
      const oldIntro = entry({ id: 1, foodId: 1, givenAt: NOW - 200 * DAY });
      const recentLog = entry({ id: 2, foodId: 1, givenAt: NOW - 2 * DAY });
      const out = computeReminders(isolated({ entries: [oldIntro, recentLog] }));
      expect(out.find((r) => r.key === 'stale-diversity')).toBeDefined();
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

    it('still fires when only a log-completeness allergen was introduced', () => {
      // Logging céleri/moutarde/crustacés/mollusques/soja shouldn't suppress
      // the LEAP/EAT high-risk-window framing : those allergens weren't
      // covered by either trial. The gate must check the priority subset,
      // not the full ALLERGENS set.
      const out = computeReminders(
        input({
          ageMonths: 5,
          entries: [entry()],
          introducedAllergens: new Set<AllergenId>(['celeri'])
        })
      );
      expect(out.find((r) => r.key === 'high-risk-window')).toBeDefined();
    });

    it('still fires when only soja was introduced', () => {
      const out = computeReminders(
        input({
          ageMonths: 5,
          entries: [entry()],
          introducedAllergens: new Set<AllergenId>(['soja'])
        })
      );
      expect(out.find((r) => r.key === 'high-risk-window')).toBeDefined();
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

  describe('default now', () => {
    it('falls back to Date.now() when input.now is omitted', () => {
      // Don't include `now` in the input : exercise the `?? Date.now()` branch.
      const out = computeReminders({
        childId: 1,
        ageMonths: 8,
        childCreatedAt: Date.now() - 30 * DAY,
        entries: [],
        introducedAllergens: ALL_ALLERGENS,
        dismissals: new Set<string>()
      });
      expect(Array.isArray(out)).toBe(true);
    });
  });

  describe('pinned now / age consistency', () => {
    it('honors a caller-pinned now so age and high-risk-window stay coherent', () => {
      // Caller pins `now` ≥ 4 months past childCreatedAt and tells us the
      // child is exactly 5 months old. The 4-11 month allergen window must
      // fire regardless of the wall clock the engine would have read by
      // default : proving the dashboard load can pin a single instant
      // through ageInMonths and computeReminders without drift.
      const pinnedNow = new Date('2026-05-06T12:00:00Z').getTime();
      const out = computeReminders({
        childId: 1,
        ageMonths: 5,
        childCreatedAt: pinnedNow - 90 * DAY,
        entries: [entry({ givenAt: pinnedNow - DAY })],
        introducedAllergens: new Set<AllergenId>(),
        dismissals: new Set<string>(),
        now: pinnedNow
      });
      expect(out.find((r) => r.key === 'high-risk-window')).toBeDefined();
    });
  });

  describe('stale-diversity reduce', () => {
    it('selects the most recent first-intro across multiple foods', () => {
      // Two foods: the more recent first-intro is inserted *before* the older
      // one so the reduce traverses both branches of `v > acc ? v : acc`.
      const newerFood = entry({ id: 2, foodId: 2, givenAt: NOW - 20 * DAY });
      const oldFood = entry({ id: 1, foodId: 1, givenAt: NOW - 200 * DAY });
      const out = computeReminders(isolated({ entries: [newerFood, oldFood] }));
      const stale = out.find((r) => r.key === 'stale-diversity');
      expect(stale).toBeDefined();
      // The window is anchored on the newer first-intro (~20 d).
      expect(stale!.title).toMatch(/20 jours/);
    });
  });

  describe('category-imbalance with custom category', () => {
    it('falls back to the raw id when the category is not in the standard map', () => {
      const entries: EnrichedEntry[] = [];
      for (let i = 0; i < 5; i++) {
        entries.push(
          entry({
            id: i,
            foodId: 1,
            category: 'mystery_group' as EnrichedEntry['category'],
            givenAt: NOW - i * DAY
          })
        );
      }
      const out = computeReminders(isolated({ entries }));
      const r = out.find((r) => r.key === 'category-imbalance:mystery_group');
      expect(r).toBeDefined();
      expect(r!.body).toContain('mystery_group');
    });
  });

  describe('maintain-allergen', () => {
    // Helper: build an entry for an allergen-bearing food. The reminders engine
    // sees EnrichedEntry.allergenType and uses it to identify allergen logs.
    function allergenEntry(
      allergen: AllergenId,
      daysAgo: number,
      overrides: Partial<EnrichedEntry> = {}
    ): EnrichedEntry {
      return entry({
        foodName: allergen,
        allergenType: allergen,
        givenAt: NOW - daysAgo * DAY,
        reaction: 'ras',
        ...overrides
      });
    }

    it('does not fire when the last exposure is within 4 days', () => {
      const out = computeReminders(
        isolated({
          introducedAllergens: new Set<AllergenId>(['oeuf']),
          entries: [allergenEntry('oeuf', 3)]
        })
      );
      expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
    });

    it('fires when the last exposure is older than 4 days', () => {
      // Use isolated() default (ALL_ALLERGENS) so rule 4 / rule 6 noise does not
      // crowd out the info-severity maintain card under the 4-card cap.
      const out = computeReminders(
        isolated({
          entries: [allergenEntry('oeuf', 5)]
        })
      );
      const card = out.find((r) => r.key === 'maintain-allergen:oeuf');
      expect(card).toBeDefined();
      expect(card?.severity).toBe('info');
    });

    it('caps at 2 cards sorted oldest-exposure-first', () => {
      // Use isolated() default (ALL_ALLERGENS) so rule 4 pending-allergen does
      // not fire for the other priority allergens and crowd the rail.
      const out = computeReminders(
        isolated({
          entries: [
            allergenEntry('oeuf', 6),
            allergenEntry('arachide', 9),
            allergenEntry('lait', 7)
          ]
        })
      );
      const keys = out.filter((r) => r.key.startsWith('maintain-allergen:')).map((r) => r.key);
      expect(keys).toEqual(['maintain-allergen:arachide', 'maintain-allergen:lait']);
    });

    it('does not fire for non-priority allergens (céleri)', () => {
      const out = computeReminders(
        isolated({
          introducedAllergens: new Set<AllergenId>(['celeri']),
          entries: [allergenEntry('celeri', 30)]
        })
      );
      expect(out.find((r) => r.key.startsWith('maintain-allergen:'))).toBeUndefined();
    });

    it('does not fire if the priority allergen was never introduced', () => {
      // No entries at all → introducedAllergens cannot include the allergen.
      const out = computeReminders(
        isolated({
          introducedAllergens: new Set<AllergenId>(), // override the isolated()
          entries: []
        })
      );
      expect(out.find((r) => r.key.startsWith('maintain-allergen:'))).toBeUndefined();
    });

    it('respects dismissal of maintain-allergen:<id>', () => {
      const out = computeReminders(
        isolated({
          introducedAllergens: new Set<AllergenId>(['oeuf']),
          entries: [allergenEntry('oeuf', 7)],
          dismissals: new Set<string>(['maintain-allergen:oeuf'])
        })
      );
      expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
    });

    it('lets reaction-state allergens still surface their pending-reaction context, but does not also emit a maintain card', () => {
      const out = computeReminders(
        isolated({
          introducedAllergens: new Set<AllergenId>(['oeuf']),
          entries: [allergenEntry('oeuf', 8, { reaction: 'reaction' })]
        })
      );
      expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
    });

    it('sorts maintain cards below important + warn severity in the final list', () => {
      const out = computeReminders(
        input({
          ageMonths: 6, // triggers stage-transition:6m (important)
          introducedAllergens: new Set<AllergenId>(['oeuf']),
          entries: [allergenEntry('oeuf', 6)]
        })
      );
      const idxImportant = out.findIndex((r) => r.key === 'stage-transition:6m');
      const idxMaintain = out.findIndex((r) => r.key === 'maintain-allergen:oeuf');
      expect(idxImportant).toBeGreaterThanOrEqual(0);
      if (idxMaintain >= 0) {
        expect(idxMaintain).toBeGreaterThan(idxImportant);
      }
    });
  });
});

import { describe, expect, it } from 'bun:test';
import { computeReminders, type ReminderInput } from './reminders';
import {
  SEVERITY_BY_KEY_FAMILY,
  TTL_BY_SEVERITY,
  keyFamily,
  ttlForReminderKey
} from './dismissal-ttl';
import type { EnrichedEntry } from './queries';
import { allergenHistoryFrom, type AllergenEntry } from './allergen-history';
import { PRIORITY_INTRODUCTION_ALLERGENS } from '#lib/utils/allergens.js';
import type { ReactionId } from '#lib/utils/reaction-values.js';

const NOW = new Date('2026-05-03T12:00:00Z').getTime();
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

/** An allergen-tagged food_entries row, `daysAgo` days before NOW. */
function allergenRow(
  allergen: string,
  daysAgo: number,
  reaction: ReactionId = 'ras',
  category = 'allergenes'
): AllergenEntry {
  return { entryId: 0, allergenType: allergen, category, reaction, givenAt: NOW - daysAgo * DAY };
}

function input(overrides: Partial<ReminderInput> = {}): ReminderInput {
  return {
    childId: 1,
    ageMonths: 8, // outside stage-transition windows (6-7, 9-10, 12-13)
    childCreatedAt: NOW - 30 * DAY,
    entries: [],
    allergens: allergenHistoryFrom([], NOW),
    dismissals: new Set<string>(),
    now: NOW,
    ...overrides
  };
}

/**
 * Isolates one rule: every priority allergen the test's `rows` don't mention is
 * given today, so pending-allergen stays quiet and nothing is due for
 * maintenance except what `rows` set up.
 */
function isolated(
  overrides: Partial<ReminderInput> = {},
  rows: AllergenEntry[] = []
): ReminderInput {
  const mentioned = new Set(rows.map((r) => r.allergenType));
  const givenToday = PRIORITY_INTRODUCTION_ALLERGENS.filter((id) => !mentioned.has(id)).map((id) =>
    allergenRow(id, 0)
  );
  return input({ allergens: allergenHistoryFrom([...rows, ...givenToday], NOW), ...overrides });
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
    it('emits warn-level reminders after diversification has started', () => {
      const out = computeReminders(input({ ageMonths: 5, entries: [entry()] }));
      const pending = out.filter((r) => r.key.startsWith('pending-allergen:'));
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].severity).toBe('warn');
    });

    it('caps at top 3', () => {
      const out = computeReminders(input({ ageMonths: 7 }));
      const pending = out.filter((r) => r.key.startsWith('pending-allergen:'));
      expect(pending.length).toBeLessThanOrEqual(3);
    });

    it('does not emit before 4 months', () => {
      const out = computeReminders(input({ ageMonths: 3, entries: [entry()] }));
      expect(out.find((r) => r.key.startsWith('pending-allergen:'))).toBeUndefined();
    });

    it('does not emit before the first diversified food', () => {
      const out = computeReminders(input({ ageMonths: 5, entries: [] }));
      expect(out.find((r) => r.key.startsWith('pending-allergen:'))).toBeUndefined();
    });

    it('skips already-introduced allergens', () => {
      const out = computeReminders(
        input({
          ageMonths: 7,
          entries: [entry()],
          allergens: allergenHistoryFrom(
            [allergenRow('oeuf', 1), allergenRow('arachide', 1), allergenRow('lait', 1)],
            NOW
          )
        })
      );
      const pending = out.filter((r) => r.key.startsWith('pending-allergen:')).map((r) => r.key);
      expect(pending).toEqual([
        'pending-allergen:gluten',
        'pending-allergen:poisson',
        'pending-allergen:fruits_a_coque'
      ]);
    });

    it('never asks to introduce an allergen that already caused symptoms, even on butter (#373)', () => {
      const out = computeReminders(
        input({
          ageMonths: 7,
          entries: [entry()],
          allergens: allergenHistoryFrom(
            [allergenRow('lait', 3, 'inconfort', 'matieres_grasses')],
            NOW
          )
        })
      );
      expect(out.find((r) => r.key === 'pending-allergen:lait')).toBeUndefined();
      expect(out.find((r) => r.key.startsWith('maintain-allergen:lait'))).toBeUndefined();
    });
  });

  describe('repeat-exposure', () => {
    it('fires for foods given once with no symptoms, > 3 days ago', () => {
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

    it('does not fire for foods associated with discomfort', () => {
      const e = entry({ foodId: 42, reaction: 'inconfort', givenAt: NOW - 5 * DAY });
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

    it('matches case-insensitively', () => {
      const e = entry({ foodName: 'Petit pot MIEL bio' });
      const out = computeReminders(input({ ageMonths: 8, entries: [e] }));
      expect(out.find((r) => r.key === 'forbidden-reminder:miel')).toBeDefined();
    });

    it('uses the canonical reason and sources from FORBIDDEN_FOODS data', () => {
      const e = entry({ foodName: 'Miel' });
      const out = computeReminders(input({ ageMonths: 6, entries: [e] }));
      const r = out.find((x) => x.key === 'forbidden-reminder:miel');
      expect(r).toBeDefined();
      expect(r!.body).toContain('botulisme');
      expect(r!.sources).toEqual(['who-cf', 'anses-nourrisson']);
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
        allergens: allergenHistoryFrom([]),
        dismissals: new Set<string>()
      });
      expect(Array.isArray(out)).toBe(true);
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

  // Which allergens are due, in what order, and which never are (blocked,
  // non-priority, butter-only) is the allergen history's maintain queue, tested
  // at its own interface. These tests pin what the rule adds on top: the
  // 7-day gate, the 2-card cap, the dismissal key and the copy.
  describe('maintain-allergen', () => {
    const maintainCards = (out: ReturnType<typeof computeReminders>) =>
      out.filter((r) => r.key.startsWith('maintain-allergen:'));

    it('does not fire before 7 days have elapsed', () => {
      const out = computeReminders(isolated({}, [allergenRow('oeuf', 6)]));
      expect(maintainCards(out)).toEqual([]);
    });

    it('fires when 7 days have elapsed', () => {
      const out = computeReminders(isolated({}, [allergenRow('oeuf', 7)]));
      const card = out.find((r) => r.key.startsWith('maintain-allergen:oeuf'));
      expect(card).toBeDefined();
      expect(card?.severity).toBe('info');
    });

    it('caps at 2 cards, most overdue first', () => {
      const out = computeReminders(
        isolated({}, [allergenRow('oeuf', 8), allergenRow('arachide', 9), allergenRow('lait', 10)])
      );
      expect(maintainCards(out).map((r) => r.key.split(':')[1])).toEqual(['lait', 'arachide']);
    });

    it('respects dismissal of the current stale cycle, but allows future cycles to surface', () => {
      const DAY_MS_LOCAL = 24 * 60 * 60 * 1000;
      const tenDaysAgo = NOW - 10 * DAY;
      const dismissedBucket = Math.floor(tenDaysAgo / DAY_MS_LOCAL);
      const dismissedKey = `maintain-allergen:oeuf:${dismissedBucket}`;

      // Dismissed for this exposure → no card
      const out1 = computeReminders(
        isolated({ dismissals: new Set<string>([dismissedKey]) }, [allergenRow('oeuf', 10)])
      );
      expect(out1.find((r) => r.key === dismissedKey)).toBeUndefined();

      // Same allergen, newer but still stale exposure → new bucket, old dismissal does not suppress it.
      const out2 = computeReminders(
        isolated({ dismissals: new Set<string>([dismissedKey]) }, [allergenRow('oeuf', 8)])
      );
      expect(out2.find((r) => r.key.startsWith('maintain-allergen:oeuf:'))).toBeDefined();
    });

    it('never nudges an allergen after a reaction, however old, even if later logs went fine (#373)', () => {
      const out = computeReminders(
        isolated({}, [allergenRow('oeuf', 100, 'reaction'), allergenRow('oeuf', 8)])
      );
      expect(maintainCards(out)).toEqual([]);
    });

    it('is displaced by higher-severity cards under the 4-card cap', () => {
      // At 6 months with only oeuf introduced, rule 4 emits 3 warn pending-allergen
      // cards for the other 6 priority allergens and rule 2 emits an important
      // stage-transition card. That fills the 4-card cap before the info-severity
      // maintain card gets a slot — by design (PRODUCT.md: maintenance never
      // displaces stage transitions or pending-allergen warnings).
      const out = computeReminders(
        input({
          ageMonths: 6,
          entries: [entry()],
          allergens: allergenHistoryFrom([allergenRow('oeuf', 8)], NOW)
        })
      );
      expect(out.find((r) => r.key === 'stage-transition:6m')).toBeDefined();
      expect(maintainCards(out)).toEqual([]);
      expect(out.length).toBe(4);
    });

    it('names the allergen and the days since its last exposure', () => {
      const out = computeReminders(isolated({}, [allergenRow('lait', 50)]));
      const card = out.find((r) => r.key.startsWith('maintain-allergen:lait'));
      expect(card?.title).toContain('Lait');
      expect(card?.body).toContain('50 jours');
    });
  });
});

describe('dismissal TTL', () => {
  // Small inputs, so the 4-card cap never hides a family. Each fixture names
  // the families it must produce; the test fails if it stops producing one.
  const fixtures: Array<{ families: string[]; input: ReminderInput }> = [
    { families: ['welcome'], input: input({ childCreatedAt: NOW - 2 * DAY }) },
    { families: ['stage-transition'], input: input({ ageMonths: 6 }) },
    {
      families: ['stale-diversity', 'repeat-exposure'],
      input: isolated({ entries: [entry({ givenAt: NOW - 20 * DAY })] })
    },
    { families: ['pending-allergen'], input: input({ ageMonths: 5, entries: [entry()] }) },
    {
      families: ['category-imbalance'],
      input: isolated({
        entries: [
          ...Array.from({ length: 5 }, (_, i) => entry({ id: i, givenAt: NOW - i * DAY })),
          entry({ id: 6, category: 'fruits', givenAt: NOW - 6 * DAY })
        ]
      })
    },
    {
      families: ['forbidden-reminder'],
      input: input({ entries: [entry({ foodName: 'Miel de lavande' })] })
    },
    {
      families: ['maintain-allergen'],
      input: isolated({ entries: [entry({ allergenType: 'oeuf', givenAt: NOW - 7 * DAY })] })
    }
  ];

  // welcome-dialog is pinned in queries.test.ts, observation-window in
  // routes/child/[id]/page.server.test.ts.
  const builtOutsideComputeReminders = new Set(['welcome-dialog', 'observation-window']);

  it('has a fixture for every family computeReminders builds', () => {
    expect(fixtures.flatMap((f) => f.families).sort()).toEqual(
      [...SEVERITY_BY_KEY_FAMILY.keys()].filter((f) => !builtOutsideComputeReminders.has(f)).sort()
    );
  });

  for (const fixture of fixtures) {
    it(`gives ${fixture.families.join(' and ')} the TTL of its severity`, () => {
      const reminders = computeReminders(fixture.input);
      expect(reminders.map((r) => keyFamily(r.key))).toEqual(
        expect.arrayContaining(fixture.families)
      );
      for (const r of reminders) {
        expect({ key: r.key, ttl: ttlForReminderKey(r.key) }).toEqual({
          key: r.key,
          ttl: TTL_BY_SEVERITY[r.severity]
        });
      }
    });
  }
});

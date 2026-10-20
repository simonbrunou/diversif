import { describe, expect, it } from 'bun:test';
import { childHistoryFrom, type HistoryEntry } from './child-history';
import { TTL_BY_SEVERITY, ttlForReminderKey, type Reminder } from './reminders';
import {
  ALLERGENS,
  PRIORITY_INTRODUCTION_ALLERGENS,
  type AllergenId
} from '#lib/utils/allergens.js';
import type { ReactionId } from '#lib/utils/reaction-values.js';

const NOW = new Date('2026-05-03T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const CHILD_ID = 1;

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 1,
    foodId: 1,
    foodName: 'Carotte',
    category: 'legumes',
    allergenType: null,
    reaction: 'ras',
    givenAt: NOW - DAY,
    texture: null,
    mealId: null,
    loggedBy: 1,
    loggedByName: 'Parent',
    ...overrides
  };
}

/** A log of an allergen-tagged food, `daysAgo` days before NOW (one food per allergen by default). */
function allergenEntry(
  allergen: AllergenId,
  daysAgo: number,
  reaction: ReactionId = 'ras',
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  const foodId = 100 + ALLERGENS.findIndex((a) => a.id === allergen);
  return entry({
    id: foodId,
    foodId,
    foodName: `food-${allergen}`,
    category: 'allergenes',
    allergenType: allergen,
    reaction,
    givenAt: NOW - daysAgo * DAY,
    ...overrides
  });
}

type Case = {
  entries?: HistoryEntry[];
  ageMonths?: number;
  childCreatedAt?: number;
  dismissals?: Iterable<string>;
};

/** The cards Aujourd'hui shows for these entries, as the loader asks for them. */
function remind({
  entries = [],
  ageMonths = 8, // outside stage-transition windows (6-7, 9-10, 12-13)
  childCreatedAt = NOW - 30 * DAY,
  dismissals = []
}: Case = {}): Reminder[] {
  return childHistoryFrom(CHILD_ID, entries, NOW).reminders({
    ageMonths,
    childCreatedAt,
    dismissals: new Set(dismissals)
  });
}

const PENDING_ALLERGEN_KEYS = PRIORITY_INTRODUCTION_ALLERGENS.map((id) => `pending-allergen:${id}`);

/**
 * Isolates one rule: the parent dismissed every pending-allergen card, so
 * those warnings don't crowd the 4-card cap.
 */
function isolated(c: Case = {}): Reminder[] {
  return remind({ ...c, dismissals: [...PENDING_ALLERGEN_KEYS, ...(c.dismissals ?? [])] });
}

const keys = (out: Reminder[]) => out.map((r) => r.key);

describe('reminders', () => {
  describe('welcome', () => {
    it('fires when child < 7 days old and 0 entries', () => {
      const out = remind({ childCreatedAt: NOW - 2 * DAY });
      expect(out.find((r) => r.key === 'welcome')).toBeDefined();
    });

    it('does not fire when child has entries', () => {
      const out = remind({ childCreatedAt: NOW - 2 * DAY, entries: [entry()] });
      expect(out.find((r) => r.key === 'welcome')).toBeUndefined();
    });

    it('does not fire when child is older than 7 days', () => {
      const out = remind({ childCreatedAt: NOW - 8 * DAY });
      expect(out.find((r) => r.key === 'welcome')).toBeUndefined();
    });
  });

  describe('stage transitions', () => {
    it('fires at 6 months', () => {
      expect(keys(remind({ ageMonths: 6 }))).toContain('stage-transition:6m');
    });

    it('fires at 9 months', () => {
      expect(keys(remind({ ageMonths: 9 }))).toContain('stage-transition:9m');
    });

    it('fires at 12 months', () => {
      expect(keys(remind({ ageMonths: 12 }))).toContain('stage-transition:12m');
    });

    it('does not fire before its window', () => {
      expect(keys(remind({ ageMonths: 5 }))).not.toContain('stage-transition:6m');
    });
  });

  describe('stale-diversity', () => {
    it('fires when no new food in 14+ days', () => {
      const out = isolated({ entries: [entry({ givenAt: NOW - 20 * DAY })] });
      expect(keys(out)).toContain('stale-diversity');
    });

    it('does not fire when last new food is recent', () => {
      const out = isolated({ entries: [entry({ givenAt: NOW - 3 * DAY })] });
      expect(keys(out)).not.toContain('stale-diversity');
    });

    it('does not fire when entries empty', () => {
      expect(keys(isolated())).not.toContain('stale-diversity');
    });

    it('does not fire before 4 months', () => {
      const out = isolated({ ageMonths: 3, entries: [entry({ givenAt: NOW - 20 * DAY })] });
      expect(keys(out)).not.toContain('stale-diversity');
    });

    it('uses earliest occurrence per food as the first-intro timestamp', () => {
      // Same food introduced 200 d ago, re-logged 2 d ago. The food is not
      // new: stale-diversity looks at the earliest log per food, not the
      // latest, so the newest *first* intro across all foods is 200 d.
      const oldIntro = entry({ id: 1, foodId: 1, givenAt: NOW - 200 * DAY });
      const recentLog = entry({ id: 2, foodId: 1, givenAt: NOW - 2 * DAY });
      expect(keys(isolated({ entries: [oldIntro, recentLog] }))).toContain('stale-diversity');
    });

    it('counts the days from the most recent first introduction across foods', () => {
      const newerFood = entry({ id: 2, foodId: 2, givenAt: NOW - 20 * DAY });
      const oldFood = entry({ id: 1, foodId: 1, givenAt: NOW - 200 * DAY });
      const stale = isolated({ entries: [newerFood, oldFood] }).find(
        (r) => r.key === 'stale-diversity'
      );
      expect(stale?.title).toMatch(/20 jours/);
    });
  });

  describe('pending-allergen', () => {
    it('emits warn-level reminders after diversification has started', () => {
      const pending = remind({ ageMonths: 5, entries: [entry()] }).filter((r) =>
        r.key.startsWith('pending-allergen:')
      );
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].severity).toBe('warn');
    });

    it('names the first 3 missing allergens, in priority order', () => {
      const out = remind({ entries: [entry()] });
      expect(keys(out).filter((k) => k.startsWith('pending-allergen:'))).toEqual([
        'pending-allergen:oeuf',
        'pending-allergen:arachide',
        'pending-allergen:lait'
      ]);
    });

    it('does not emit before 4 months', () => {
      const out = remind({ ageMonths: 3, entries: [entry()] });
      expect(keys(out).some((k) => k.startsWith('pending-allergen:'))).toBe(false);
    });

    it('does not emit before the first diversified food', () => {
      const out = remind({ ageMonths: 5 });
      expect(keys(out).some((k) => k.startsWith('pending-allergen:'))).toBe(false);
    });

    it('skips already-introduced allergens', () => {
      const out = remind({
        entries: [allergenEntry('oeuf', 1), allergenEntry('arachide', 1), allergenEntry('lait', 1)]
      });
      expect(keys(out).filter((k) => k.startsWith('pending-allergen:'))).toEqual([
        'pending-allergen:gluten',
        'pending-allergen:poisson',
        'pending-allergen:fruits_a_coque'
      ]);
    });

    it('never asks to introduce an allergen that already caused symptoms, even on butter (#373)', () => {
      const out = remind({
        entries: [allergenEntry('lait', 3, 'inconfort', { category: 'matieres_grasses' })]
      });
      expect(keys(out)).not.toContain('pending-allergen:lait');
    });

    it('still asks for lait after butter logged without symptoms, a fat being no exposure', () => {
      const out = remind({
        entries: [allergenEntry('lait', 8, 'ras', { category: 'matieres_grasses' })]
      });
      expect(keys(out)).toContain('pending-allergen:lait');
    });
  });

  describe('repeat-exposure', () => {
    it('fires for foods given once with no symptoms, > 3 days ago', () => {
      const e = entry({ foodId: 42, foodName: 'Brocoli', givenAt: NOW - 5 * DAY });
      const r = isolated({ entries: [e] }).find((x) => x.key === 'repeat-exposure:42');
      expect(r?.title).toContain('Brocoli');
      expect(r?.cta?.href).toBe(`/child/${CHILD_ID}/log?foodId=42`);
    });

    it('does not fire for foods given more than once', () => {
      const e1 = entry({ foodId: 42, givenAt: NOW - 5 * DAY });
      const e2 = entry({ id: 2, foodId: 42, givenAt: NOW - 4 * DAY });
      expect(keys(isolated({ entries: [e1, e2] }))).not.toContain('repeat-exposure:42');
    });

    it('does not fire for foods with a true reaction', () => {
      const e = entry({ foodId: 42, reaction: 'reaction', givenAt: NOW - 5 * DAY });
      expect(keys(isolated({ entries: [e] }))).not.toContain('repeat-exposure:42');
    });

    it('does not fire for foods associated with discomfort', () => {
      const e = entry({ foodId: 42, reaction: 'inconfort', givenAt: NOW - 5 * DAY });
      expect(keys(isolated({ entries: [e] }))).not.toContain('repeat-exposure:42');
    });

    it('does not re-propose a food whose allergen caused symptoms on another food (#373)', () => {
      // Céleri is not a priority allergen, so the repeat rule may pick its foods.
      const fine = allergenEntry('celeri', 5, 'ras', { foodId: 10, foodName: 'Céleri-rave' });
      const symptoms = allergenEntry('celeri', 4, 'reaction', {
        id: 11,
        foodId: 11,
        foodName: 'Céleri branche'
      });
      const out = isolated({ entries: [fine, symptoms] });
      expect(keys(out).some((k) => k.startsWith('repeat-exposure:'))).toBe(false);
    });

    it('leaves priority allergens to the maintain rule', () => {
      const out = isolated({ entries: [allergenEntry('oeuf', 5)] });
      expect(keys(out).some((k) => k.startsWith('repeat-exposure:'))).toBe(false);
    });

    it('waits more than 3 days after the food was given', () => {
      const atEdge = entry({ foodId: 42, givenAt: NOW - 3 * DAY });
      expect(keys(isolated({ entries: [atEdge] }))).not.toContain('repeat-exposure:42');
    });

    it('proposes the 2 longest-unseen foods', () => {
      const out = isolated({
        dismissals: ['stale-diversity'],
        entries: [5, 9, 7].map((daysAgo) =>
          entry({ id: daysAgo, foodId: daysAgo, givenAt: NOW - daysAgo * DAY })
        )
      });
      expect(keys(out).filter((k) => k.startsWith('repeat-exposure:'))).toEqual([
        'repeat-exposure:9',
        'repeat-exposure:7'
      ]);
    });
  });

  describe('category-imbalance', () => {
    it('fires when one category > 60% of last 14 days', () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        // Same food repeated so repeat-exposure does not fire.
        entry({ id: i, foodId: 1, category: 'legumes', givenAt: NOW - i * DAY })
      );
      entries.push(entry({ id: 6, foodId: 1, category: 'fruits', givenAt: NOW - 6 * DAY }));
      expect(keys(isolated({ entries }))).toContain('category-imbalance:legumes');
    });

    it('does not fire when balanced', () => {
      const entries = (['legumes', 'fruits', 'feculents', 'viandes', 'oeufs'] as const).map(
        (category, i) => entry({ id: i, foodId: 1, category, givenAt: NOW - (i + 1) * DAY })
      );
      expect(keys(isolated({ entries })).some((k) => k.startsWith('category-imbalance:'))).toBe(
        false
      );
    });

    it('needs 5 entries in the last 14 days', () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        entry({ id: i, foodId: 1, givenAt: NOW - (i === 0 ? 20 : i) * DAY })
      );
      expect(keys(isolated({ entries })).some((k) => k.startsWith('category-imbalance:'))).toBe(
        false
      );
    });

    it('falls back to the raw id when the category is not in the standard map', () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        entry({
          id: i,
          foodId: 1,
          category: 'mystery_group' as HistoryEntry['category'],
          givenAt: NOW - i * DAY
        })
      );
      const r = isolated({ entries }).find((x) => x.key === 'category-imbalance:mystery_group');
      expect(r?.body).toContain('mystery_group');
    });
  });

  describe('forbidden-reminder', () => {
    it('fires when honey is logged before 12 mo', () => {
      const out = remind({ entries: [entry({ foodName: 'Miel de lavande' })] });
      expect(keys(out)).toContain('forbidden-reminder:miel');
    });

    it('does not fire after 12 mo', () => {
      const out = remind({ ageMonths: 14, entries: [entry({ foodName: 'Miel de lavande' })] });
      expect(keys(out)).not.toContain('forbidden-reminder:miel');
    });

    it('matches case-insensitively', () => {
      const out = remind({ entries: [entry({ foodName: 'Petit pot MIEL bio' })] });
      expect(keys(out)).toContain('forbidden-reminder:miel');
    });

    it('uses the canonical reason and sources from FORBIDDEN_FOODS data', () => {
      const out = remind({ ageMonths: 6, entries: [entry({ foodName: 'Miel' })] });
      const r = out.find((x) => x.key === 'forbidden-reminder:miel');
      expect(r?.body).toContain('botulisme');
      expect(r?.sources).toEqual(['who-cf', 'anses-nourrisson']);
    });
  });

  // Which allergens are due, in what order, and which never are (blocked,
  // non-priority, butter-only) is the allergen history's maintain queue, tested
  // at its own interface. These tests pin what the rule adds on top: it reads
  // only the `overdue` entries, the 2-card cap, the dismissal key and the copy.
  describe('maintain-allergen', () => {
    const maintainCards = (out: Reminder[]) =>
      out.filter((r) => r.key.startsWith('maintain-allergen:'));

    it('does not fire before 7 days have elapsed', () => {
      expect(maintainCards(isolated({ entries: [allergenEntry('oeuf', 6)] }))).toEqual([]);
    });

    it('fires when 7 days have elapsed', () => {
      const card = maintainCards(isolated({ entries: [allergenEntry('oeuf', 7)] }))[0];
      expect(card?.key).toStartWith('maintain-allergen:oeuf:');
      expect(card?.severity).toBe('info');
    });

    it('caps at 2 cards, most overdue first', () => {
      const out = isolated({
        entries: [allergenEntry('oeuf', 8), allergenEntry('arachide', 9), allergenEntry('lait', 10)]
      });
      expect(maintainCards(out).map((r) => r.key.split(':')[1])).toEqual(['lait', 'arachide']);
    });

    it('respects dismissal of the current stale cycle, but allows future cycles to surface', () => {
      const dismissedKey = `maintain-allergen:oeuf:${Math.floor((NOW - 10 * DAY) / DAY)}`;
      // Dismissed for this exposure → no card.
      const out1 = isolated({ entries: [allergenEntry('oeuf', 10)], dismissals: [dismissedKey] });
      expect(maintainCards(out1)).toEqual([]);
      // A newer but still stale exposure → new bucket, the old dismissal does not suppress it.
      const out2 = isolated({ entries: [allergenEntry('oeuf', 8)], dismissals: [dismissedKey] });
      expect(maintainCards(out2)).toHaveLength(1);
    });

    it('is displaced by higher-severity cards under the 4-card cap', () => {
      // At 6 months with only oeuf introduced, 3 warn pending-allergen cards
      // and an important stage-transition card fill the cap before the info
      // maintain card gets a slot, by design: maintenance never displaces
      // important or warn cards (docs/superpowers/specs/2026-05-15-allergen-maintenance-design.md).
      const out = remind({ ageMonths: 6, entries: [entry(), allergenEntry('oeuf', 8)] });
      expect(keys(out)).toContain('stage-transition:6m');
      expect(maintainCards(out)).toEqual([]);
      expect(out).toHaveLength(4);
    });

    it('names the allergen and the days since its last exposure', () => {
      const card = maintainCards(isolated({ entries: [allergenEntry('lait', 50)] }))[0];
      expect(card?.title).toContain('Lait');
      expect(card?.body).toContain('50 jours');
    });
  });

  describe('observation-window', () => {
    it('points at a non-RAS entry of the last 48 h, as a warning', () => {
      const e = entry({ id: 77, foodName: 'Poire', reaction: 'inconfort', givenAt: NOW - HOUR });
      const card = isolated({ entries: [e] }).find((r) => r.key === 'observation-window:77');
      expect(card?.severity).toBe('warn');
      expect(card?.title).toContain('Poire');
      expect(card?.cta?.href).toBe(`/child/${CHILD_ID}/foods/77`);
    });

    it('picks the latest such entry', () => {
      const older = entry({ id: 1, foodId: 1, reaction: 'reaction', givenAt: NOW - 30 * HOUR });
      const latest = entry({ id: 2, foodId: 2, reaction: 'inconfort', givenAt: NOW - 2 * HOUR });
      const out = isolated({ entries: [older, latest] });
      expect(keys(out).filter((k) => k.startsWith('observation-window:'))).toEqual([
        'observation-window:2'
      ]);
    });

    it('does not fire once the entry is older than 48 h', () => {
      const e = entry({ reaction: 'inconfort', givenAt: NOW - 49 * HOUR });
      expect(keys(isolated({ entries: [e] })).some((k) => k.startsWith('observation-'))).toBe(
        false
      );
    });

    it('does not fire when every recent entry is RAS', () => {
      const out = isolated({ entries: [entry({ givenAt: NOW - HOUR })] });
      expect(keys(out).some((k) => k.startsWith('observation-'))).toBe(false);
    });

    it("stays dismissed for its entry, and doesn't fall back to an older one", () => {
      const older = entry({ id: 1, foodId: 1, reaction: 'reaction', givenAt: NOW - 30 * HOUR });
      const latest = entry({ id: 2, foodId: 2, reaction: 'inconfort', givenAt: NOW - 2 * HOUR });
      const out = isolated({ entries: [older, latest], dismissals: ['observation-window:2'] });
      expect(keys(out).some((k) => k.startsWith('observation-'))).toBe(false);
    });
  });

  describe('display order and cap', () => {
    it('leads with the observation window, then important, warn and info cards, 4 at most', () => {
      // 6 months: stage transition (important). Honey: forbidden (important).
      // A reaction an hour ago: observation window (warn). Pending allergens
      // (warn) and stale diversity (info) would follow.
      const out = remind({
        ageMonths: 6,
        entries: [
          entry({ id: 1, foodId: 1, foodName: 'Miel', givenAt: NOW - 20 * DAY }),
          entry({ id: 2, foodId: 1, foodName: 'Miel', reaction: 'inconfort', givenAt: NOW - HOUR })
        ]
      });
      expect(keys(out)).toEqual([
        'observation-window:2',
        'stage-transition:6m',
        'forbidden-reminder:miel',
        'pending-allergen:oeuf'
      ]);
    });

    it('orders important > warn > info among the other cards', () => {
      const out = remind({
        ageMonths: 6,
        entries: [entry({ givenAt: NOW - 20 * DAY })],
        dismissals: PENDING_ALLERGEN_KEYS.slice(1)
      });
      expect(out.map((r) => r.severity)).toEqual(['important', 'warn', 'info', 'info']);
    });

    it('honors dismissals', () => {
      const out = remind({ childCreatedAt: NOW - 2 * DAY, dismissals: ['welcome'] });
      expect(keys(out)).not.toContain('welcome');
    });
  });
});

describe('ttlForReminderKey', () => {
  const NEVER = Infinity;
  const WARN_TTL = 90 * DAY;
  const INFO_TTL = 30 * DAY;

  it('holds a dismissal for as long as the severity its family is shown with', () => {
    const cases: Array<[string, number]> = [
      ['welcome', NEVER],
      ['welcome-dialog', NEVER],
      ['stage-transition:6m', NEVER],
      ['forbidden-reminder:miel', NEVER],
      ['pending-allergen:oeuf', WARN_TTL],
      ['observation-window:42', WARN_TTL],
      ['stale-diversity', INFO_TTL],
      ['repeat-exposure:3', INFO_TTL],
      ['category-imbalance:legumes', INFO_TTL],
      ['maintain-allergen:oeuf:20000', INFO_TTL]
    ];
    expect(cases.map(([key]) => [key, ttlForReminderKey(key)])).toEqual(cases);
  });

  it('matches the severity of every card the rules build', () => {
    const out = [
      ...remind({ childCreatedAt: NOW - 2 * DAY }),
      ...remind({ ageMonths: 6, entries: [entry({ foodName: 'Miel', reaction: 'reaction' })] }),
      ...isolated({ entries: [entry({ givenAt: NOW - 20 * DAY }), allergenEntry('oeuf', 9)] })
    ];
    for (const r of out) {
      expect({ key: r.key, ttl: ttlForReminderKey(r.key) }).toEqual({
        key: r.key,
        ttl: TTL_BY_SEVERITY[r.severity]
      });
    }
  });

  it('falls back to the info TTL for an unknown family, prototype names included', () => {
    expect(ttlForReminderKey('constructor')).toBe(INFO_TTL);
    expect(ttlForReminderKey('__proto__:x')).toBe(INFO_TTL);
  });
});

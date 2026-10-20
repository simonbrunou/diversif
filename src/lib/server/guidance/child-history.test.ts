import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';
import { children, foodEntries, foods, users } from '#lib/server/db/schema.js';
import { groupByMeal } from '#lib/utils/meals.js';
import { childHistoryFrom, loadChildHistory, type HistoryEntry } from './child-history';

const CHILD_ID = 7;
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2024, 5, 10, 12); // 2024-06-10 12:00 UTC

let nextId = 1;

/** One entry of child CHILD_ID, a day before NOW unless overridden. */
function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: nextId++,
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

/** An entry at 10:00 UTC on the given day of June 2024. */
const onJune = (day: number) => entry({ givenAt: Date.UTC(2024, 5, day, 10) });

describe('loadChildHistory', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  async function insertUser(email: string, displayName: string) {
    const [user] = await testDb
      .insert(users)
      .values({ email, passwordHash: 'pw', displayName, createdAt: new Date() })
      .returning();
    return user;
  }

  async function insertChild(createdBy: number, name: string) {
    const [child] = await testDb
      .insert(children)
      .values({ name, birthDate: '2024-01-01', createdBy, createdAt: new Date() })
      .returning();
    return child;
  }

  async function insertFood(name: string, category: string, allergenType: string | null) {
    const [food] = await testDb
      .insert(foods)
      .values({
        name,
        category,
        isMajorAllergen: allergenType !== null,
        allergenType,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();
    return food;
  }

  it("reads one child's entries with their food and logger, and answers every view from them", async () => {
    const parent = await insertUser('parent@example.com', 'Parent');
    const partner = await insertUser('partner@example.com', 'Partenaire');
    const child = await insertChild(parent.id, 'Bébé');
    const sibling = await insertChild(parent.id, 'Aîné');
    const egg = await insertFood('Œuf dur', 'oeufs', 'oeuf');
    const carrot = await insertFood('Carotte', 'legumes', null);
    const [eggEntry, carrotEntry] = await testDb
      .insert(foodEntries)
      .values([
        {
          childId: child.id,
          foodId: egg.id,
          givenAt: new Date(NOW - 2 * DAY),
          reaction: 'ras',
          texture: 'ecrasee',
          notes: 'Pas de souci',
          loggedBy: parent.id,
          createdAt: new Date()
        },
        {
          childId: child.id,
          foodId: carrot.id,
          givenAt: new Date(NOW - DAY),
          reaction: 'inconfort',
          mealId: 'm1',
          loggedBy: partner.id,
          createdAt: new Date()
        },
        // Another child's entry counts in no view.
        {
          childId: sibling.id,
          foodId: carrot.id,
          givenAt: new Date(NOW),
          reaction: 'ras',
          loggedBy: parent.id,
          createdAt: new Date()
        }
      ])
      .returning();
    // Deleting the partner's account keeps their entry, logged by nobody.
    await testDb.delete(users).where(eq(users.id, partner.id));

    const history = loadChildHistory(testDb, child.id, NOW);

    expect(history.recent).toEqual([
      {
        id: carrotEntry.id,
        foodId: carrot.id,
        foodName: 'Carotte',
        category: 'legumes',
        reaction: 'inconfort',
        givenAt: NOW - DAY,
        texture: null,
        mealId: 'm1',
        loggedByName: 'Compte supprimé'
      },
      {
        id: eggEntry.id,
        foodId: egg.id,
        foodName: 'Œuf dur',
        category: 'oeufs',
        reaction: 'ras',
        givenAt: NOW - 2 * DAY,
        texture: 'ecrasee',
        mealId: null,
        loggedByName: 'Parent'
      }
    ]);
    expect(history.foodsIntroduced).toBe(2);
    expect(history.coparentActivity(parent.id)).toEqual([]);
    const allergens = new Map(history.allergens.statuses.map((a) => [a.id, a.state]));
    expect(allergens.get('oeuf')).toBe('cleared');
    expect(allergens.get('arachide')).toBe('todo');
  });

  it('is empty for a child with no entries', async () => {
    const parent = await insertUser('parent@example.com', 'Parent');
    const child = await insertChild(parent.id, 'Bébé');
    const history = loadChildHistory(testDb, child.id, NOW);
    expect(history.recent).toEqual([]);
    expect(history.allergens.isIntroduced('oeuf')).toBe(false);
  });
});

describe('recent', () => {
  it('lists the 20 latest entries, newest first, a meal ordered by entry id', () => {
    const meal = [3, 1, 2].map((id) =>
      entry({ id: 100 + id, foodId: id, givenAt: NOW - 60_000, mealId: 'm1' })
    );
    const older = Array.from({ length: 25 }, (_, i) => entry({ givenAt: NOW - (i + 1) * DAY }));
    const recent = childHistoryFrom(CHILD_ID, [...older, ...meal], NOW).recent;
    expect(recent).toHaveLength(20);
    expect(recent.slice(0, 4).map((e) => e.id)).toEqual([101, 102, 103, older[0].id]);
  });

  it('carries what the feed shows, and names a deleted account « Compte supprimé »', () => {
    const e = entry({
      id: 42,
      foodId: 3,
      foodName: 'Poire',
      category: 'fruits',
      allergenType: 'lait',
      reaction: 'inconfort',
      texture: 'lisse',
      mealId: 'm1',
      loggedBy: null,
      loggedByName: null
    });
    expect(childHistoryFrom(CHILD_ID, [e], NOW).recent).toEqual([
      {
        id: 42,
        foodId: 3,
        foodName: 'Poire',
        category: 'fruits',
        reaction: 'inconfort',
        givenAt: NOW - DAY,
        texture: 'lisse',
        mealId: 'm1',
        loggedByName: 'Compte supprimé'
      }
    ]);
  });
});

describe('foodsIntroduced and newFoodsThisWeek', () => {
  it('counts distinct foods, and the ones first logged in the last 7 days', () => {
    const carrot = (daysAgo: number) => entry({ foodId: 1, givenAt: NOW - daysAgo * DAY });
    const apple = (daysAgo: number) => entry({ foodId: 2, givenAt: NOW - daysAgo * DAY });
    const pear = (daysAgo: number) => entry({ foodId: 3, givenAt: NOW - daysAgo * DAY });
    const history = childHistoryFrom(
      CHILD_ID,
      // Carotte was first logged 10 days ago, so today's repeat is not new.
      // Pomme is new this week: three logs still count once. Poire's first log
      // is exactly 7 days old, the edge of the window.
      [carrot(10), carrot(0), apple(2), apple(1), apple(0), pear(7)],
      NOW
    );
    expect(history.foodsIntroduced).toBe(3);
    expect(history.newFoodsThisWeek).toBe(2);
  });

  it('is zero for both with no entries', () => {
    const history = childHistoryFrom(CHILD_ID, [], NOW);
    expect(history.foodsIntroduced).toBe(0);
    expect(history.newFoodsThisWeek).toBe(0);
  });
});

describe('coparentActivity', () => {
  const VIEWER = 1;
  const PARTNER = 2;
  const byPartner = (overrides: Partial<HistoryEntry> = {}) =>
    entry({ loggedBy: PARTNER, loggedByName: 'Partenaire', ...overrides });

  it('is empty when only the viewer logged', () => {
    const history = childHistoryFrom(CHILD_ID, [entry({ loggedBy: VIEWER })], NOW);
    expect(history.coparentActivity(VIEWER)).toEqual([]);
  });

  it("leaves out the viewer's entries and a deleted account's", () => {
    const partner = byPartner({ id: 50, foodName: 'Pomme', category: 'fruits', mealId: 'm1' });
    const deleted = entry({ loggedBy: null, loggedByName: null });
    const history = childHistoryFrom(
      CHILD_ID,
      [entry({ loggedBy: VIEWER }), partner, deleted],
      NOW
    );
    expect(history.coparentActivity(VIEWER)).toEqual([
      {
        id: 50,
        foodName: 'Pomme',
        category: 'fruits',
        reaction: 'ras',
        givenAt: NOW - DAY,
        loggedByName: 'Partenaire',
        mealId: 'm1'
      }
    ]);
  });

  it('keeps the last 7 days, newest first', () => {
    const history = childHistoryFrom(
      CHILD_ID,
      [
        byPartner({ id: 1, givenAt: NOW - 8 * DAY }),
        byPartner({ id: 2, givenAt: NOW - 2 * DAY }),
        byPartner({ id: 3, givenAt: NOW - 7 * DAY }),
        byPartner({ id: 4, givenAt: NOW - DAY })
      ],
      NOW
    );
    expect(history.coparentActivity(VIEWER).map((e) => e.id)).toEqual([4, 2, 3]);
  });

  it('shows at most 5 entries', () => {
    const entries = Array.from({ length: 8 }, (_, i) => byPartner({ givenAt: NOW - i * 60_000 }));
    expect(childHistoryFrom(CHILD_ID, entries, NOW).coparentActivity(VIEWER)).toHaveLength(5);
  });

  it("keeps a co-parent's meal adjacent, so groupByMeal folds it into one group", () => {
    const meal = ['Carotte', 'Poire', 'Poulet'].map((foodName, i) =>
      byPartner({ id: 10 + i, foodId: 10 + i, foodName, givenAt: NOW - 60_000, mealId: 'm1' })
    );
    // An older singleton that would split the meal if the order were lost.
    const single = byPartner({ id: 9, foodName: 'Pomme', givenAt: NOW - 120_000 });
    const out = childHistoryFrom(CHILD_ID, [meal[2], single, meal[0], meal[1]], NOW);
    const groups = groupByMeal(out.coparentActivity(VIEWER));
    expect(groups.map((g) => [g.mealId, g.members.length])).toEqual([
      ['m1', 3],
      [null, 1]
    ]);
  });
});

describe('repeatCandidates', () => {
  const log = (foodId: number, daysAgo: number, reaction: HistoryEntry['reaction'] = 'ras') =>
    entry({ foodId, foodName: `food-${foodId}`, reaction, givenAt: NOW - daysAgo * DAY });

  it('lists foods logged at most twice, never with symptoms, the longest unseen first', () => {
    const history = childHistoryFrom(
      CHILD_ID,
      [log(1, 1), log(2, 10), log(2, 4), log(3, 6), log(3, 5), log(3, 2), log(4, 8)],
      NOW
    );
    expect(history.repeatCandidates.map((c) => [c.foodId, c.count, c.lastAt])).toEqual([
      [4, 1, NOW - 8 * DAY],
      [2, 2, NOW - 4 * DAY],
      [1, 1, NOW - DAY]
    ]);
  });

  it('leaves out a food whose any entry carried symptoms, even an older one', () => {
    const history = childHistoryFrom(
      CHILD_ID,
      [log(1, 2, 'reaction'), log(1, 1), log(2, 3, 'inconfort'), log(3, 1)],
      NOW
    );
    expect(history.repeatCandidates.map((c) => c.foodId)).toEqual([3]);
  });

  it('is empty with no entries', () => {
    expect(childHistoryFrom(CHILD_ID, [], NOW).repeatCandidates).toEqual([]);
  });
});

describe('streak', () => {
  it('is zero with no entries', () => {
    expect(childHistoryFrom(CHILD_ID, [], NOW).streak).toEqual({ current: 0, record: 0 });
  });

  it('breaks after a missed day, but the record survives', () => {
    expect(childHistoryFrom(CHILD_ID, [onJune(5)], NOW).streak).toEqual({
      current: 0,
      record: 1
    });
  });

  it('counts an entry logged today as a 1-day streak', () => {
    const history = childHistoryFrom(CHILD_ID, [onJune(10)], Date.UTC(2024, 5, 10, 20));
    expect(history.streak).toEqual({ current: 1, record: 1 });
  });

  it('starts yesterday when nothing is logged today yet', () => {
    expect(childHistoryFrom(CHILD_ID, [onJune(8), onJune(9)], NOW).streak).toEqual({
      current: 2,
      record: 2
    });
  });

  it('counts consecutive UTC days and stops at the first gap', () => {
    const entries = [3, 4, 6, 8, 9, 10].map(onJune);
    // 8, 9, 10 in a row, then the gap at 7. Nothing earlier beats it.
    expect(childHistoryFrom(CHILD_ID, entries, NOW).streak).toEqual({ current: 3, record: 3 });
  });

  it('keeps a longer past run as the record while the current streak is shorter', () => {
    const entries = [1, 2, 3, 4, 9, 10].map(onJune);
    expect(childHistoryFrom(CHILD_ID, entries, NOW).streak).toEqual({ current: 2, record: 4 });
  });

  it('counts a day once, however many entries it holds, whatever their order', () => {
    const entries = [onJune(10), onJune(8), onJune(9), onJune(9), onJune(10)];
    expect(childHistoryFrom(CHILD_ID, entries, NOW).streak).toEqual({ current: 3, record: 3 });
  });

  it('buckets by UTC day: 23:30 and 00:30 UTC are two days', () => {
    const late = entry({ givenAt: Date.UTC(2024, 5, 9, 23, 30) });
    const early = entry({ givenAt: Date.UTC(2024, 5, 10, 0, 30) });
    expect(childHistoryFrom(CHILD_ID, [late, early], NOW).streak).toEqual({
      current: 2,
      record: 2
    });
  });
});

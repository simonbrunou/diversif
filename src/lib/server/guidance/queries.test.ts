import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import {
  loadRecentEntries,
  loadDiversityMetrics,
  loadRepeatCandidates,
  loadDismissals,
  dismissReminder
} from './queries';
import { children, foods, foodEntries, users, tipDismissals } from '../db/schema';
import { eq } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedUserAndChild() {
  const user = testDb
    .insert(users)
    .values({
      email: 'p@example.com',
      passwordHash: 'pw',
      displayName: 'P',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
  const child = testDb
    .insert(children)
    .values({
      name: 'Bébé',
      birthDate: '2024-01-01',
      createdBy: user.id,
      createdAt: new Date()
    })
    .returning()
    .all()[0];
  return { user, child };
}

function seedFood(opts: { name: string; category: string; allergen?: string | null }) {
  return testDb
    .insert(foods)
    .values({
      name: opts.name,
      category: opts.category,
      isMajorAllergen: opts.allergen != null,
      allergenType: opts.allergen ?? null,
      suggestedAgeMonths: 6,
      notes: null,
      isCustom: false,
      customForChildId: null
    })
    .returning()
    .all()[0];
}

function logEntry(opts: {
  childId: number;
  foodId: number;
  userId: number;
  givenAt: Date;
  reaction: 'ras' | 'inconfort' | 'reaction';
}) {
  return testDb
    .insert(foodEntries)
    .values({
      childId: opts.childId,
      foodId: opts.foodId,
      givenAt: opts.givenAt,
      reaction: opts.reaction,
      notes: null,
      loggedBy: opts.userId,
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

beforeEach(() => {
  resetTestDb();
});

describe('loadRecentEntries', () => {
  it('returns entries within the day window, newest first', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = seedFood({ name: 'Pomme', category: 'fruits' });
    const old = seedFood({ name: 'Ancien', category: 'legumes' });
    const now = Date.now();
    logEntry({
      childId: child.id,
      foodId: old.id,
      userId: user.id,
      givenAt: new Date(now - 30 * DAY_MS),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date(now - 2 * DAY_MS),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: new Date(now - 1 * DAY_MS),
      reaction: 'inconfort'
    });

    const out = loadRecentEntries(child.id, 7);
    expect(out.map((e) => e.foodName)).toEqual(['Pomme', 'Carotte']);
    expect(out[0].category).toBe('fruits');
    expect(typeof out[0].givenAt).toBe('number');
  });

  it('returns empty when no entries match', async () => {
    const { child } = await seedUserAndChild();
    expect(loadRecentEntries(child.id, 7)).toEqual([]);
  });
});

describe('loadDiversityMetrics', () => {
  it('counts distinct categories ignoring "autre"', async () => {
    const { user, child } = await seedUserAndChild();
    const veg = seedFood({ name: 'Carotte', category: 'legumes' });
    const fruit = seedFood({ name: 'Pomme', category: 'fruits' });
    const autre = seedFood({ name: 'Autre', category: 'autre' });
    const now = Date.now();
    logEntry({
      childId: child.id,
      foodId: veg.id,
      userId: user.id,
      givenAt: new Date(now - 1000),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: fruit.id,
      userId: user.id,
      givenAt: new Date(now - 2000),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: autre.id,
      userId: user.id,
      givenAt: new Date(now - 3000),
      reaction: 'ras'
    });

    const m = loadDiversityMetrics(child.id, 11);
    expect(m.categoriesCovered).toBe(2);
    expect(m.totalCategories).toBe(11);
    expect(m.lastNewFoodAt).not.toBeNull();
    expect(m.repeatExposureCount).toBe(3);
  });

  it('returns zeros when no entries', async () => {
    const { child } = await seedUserAndChild();
    const m = loadDiversityMetrics(child.id, 11);
    expect(m.categoriesCovered).toBe(0);
    expect(m.lastNewFoodAt).toBeNull();
    expect(m.repeatExposureCount).toBe(0);
  });

  it('excludes foods given >= 3 times from repeat exposure', async () => {
    const { user, child } = await seedUserAndChild();
    const food = seedFood({ name: 'Carotte', category: 'legumes' });
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      logEntry({
        childId: child.id,
        foodId: food.id,
        userId: user.id,
        givenAt: new Date(now - i * 1000),
        reaction: 'ras'
      });
    }
    expect(loadDiversityMetrics(child.id, 11).repeatExposureCount).toBe(0);
  });

  it('excludes foods whose worst reaction is "reaction"', async () => {
    const { user, child } = await seedUserAndChild();
    const food = seedFood({ name: 'Carotte', category: 'legumes' });
    logEntry({
      childId: child.id,
      foodId: food.id,
      userId: user.id,
      givenAt: new Date(),
      reaction: 'reaction'
    });
    expect(loadDiversityMetrics(child.id, 11).repeatExposureCount).toBe(0);
  });
});

describe('loadRepeatCandidates', () => {
  it('returns foods needing follow-up, oldest first, capped by limit', async () => {
    const { user, child } = await seedUserAndChild();
    const a = seedFood({ name: 'A', category: 'legumes' });
    const b = seedFood({ name: 'B', category: 'fruits' });
    const c = seedFood({ name: 'C', category: 'feculents' });
    const now = Date.now();
    logEntry({
      childId: child.id,
      foodId: a.id,
      userId: user.id,
      givenAt: new Date(now - 10 * DAY_MS),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: b.id,
      userId: user.id,
      givenAt: new Date(now - 5 * DAY_MS),
      reaction: 'inconfort'
    });
    logEntry({
      childId: child.id,
      foodId: c.id,
      userId: user.id,
      givenAt: new Date(now - 1 * DAY_MS),
      reaction: 'ras'
    });

    const out = loadRepeatCandidates(child.id, 2);
    expect(out.length).toBe(2);
    expect(out[0].foodName).toBe('A'); // oldest first
    expect(out[1].foodName).toBe('B');
  });

  it('uses default limit of 5', async () => {
    const { child } = await seedUserAndChild();
    expect(loadRepeatCandidates(child.id)).toEqual([]);
  });
});

describe('loadDismissals / dismissReminder', () => {
  it('returns an empty set when nothing dismissed', async () => {
    const { user, child } = await seedUserAndChild();
    expect(loadDismissals(user.id, child.id).size).toBe(0);
  });

  it('persists dismissal and reflects it on next read', async () => {
    const { user, child } = await seedUserAndChild();
    dismissReminder(user.id, child.id, 'welcome');
    expect(loadDismissals(user.id, child.id).has('welcome')).toBe(true);
  });

  it('upserts dismissal on conflict (no duplicate row)', async () => {
    const { user, child } = await seedUserAndChild();
    dismissReminder(user.id, child.id, 'high-risk-window');
    dismissReminder(user.id, child.id, 'high-risk-window');
    const rows = testDb.select().from(tipDismissals).where(eq(tipDismissals.userId, user.id)).all();
    expect(rows.length).toBe(1);
  });

  it('honors TTL — info reminders expire after 30 days', async () => {
    const { user, child } = await seedUserAndChild();
    const longAgo = new Date(Date.now() - 31 * DAY_MS);
    testDb
      .insert(tipDismissals)
      .values({
        userId: user.id,
        childId: child.id,
        reminderKey: 'stale-diversity',
        dismissedAt: longAgo
      })
      .run();
    expect(loadDismissals(user.id, child.id).has('stale-diversity')).toBe(false);
  });

  it('honors TTL — warn reminders expire after 90 days', async () => {
    const { user, child } = await seedUserAndChild();
    const longAgo = new Date(Date.now() - 91 * DAY_MS);
    testDb
      .insert(tipDismissals)
      .values({
        userId: user.id,
        childId: child.id,
        reminderKey: 'pending-allergen:oeuf',
        dismissedAt: longAgo
      })
      .run();
    expect(loadDismissals(user.id, child.id).has('pending-allergen:oeuf')).toBe(false);
  });

  it('keeps warn reminders within TTL', async () => {
    const { user, child } = await seedUserAndChild();
    const recent = new Date(Date.now() - 5 * DAY_MS);
    testDb
      .insert(tipDismissals)
      .values({
        userId: user.id,
        childId: child.id,
        reminderKey: 'pending-allergen:oeuf',
        dismissedAt: recent
      })
      .run();
    expect(loadDismissals(user.id, child.id).has('pending-allergen:oeuf')).toBe(true);
  });

  it('important reminders never expire', async () => {
    const { user, child } = await seedUserAndChild();
    const veryLongAgo = new Date(Date.now() - 365 * DAY_MS);
    testDb
      .insert(tipDismissals)
      .values([
        {
          userId: user.id,
          childId: child.id,
          reminderKey: 'welcome',
          dismissedAt: veryLongAgo
        },
        {
          userId: user.id,
          childId: child.id,
          reminderKey: 'welcome-dialog',
          dismissedAt: veryLongAgo
        },
        {
          userId: user.id,
          childId: child.id,
          reminderKey: 'stage-transition:6m',
          dismissedAt: veryLongAgo
        },
        {
          userId: user.id,
          childId: child.id,
          reminderKey: 'forbidden-reminder:miel',
          dismissedAt: veryLongAgo
        }
      ])
      .run();
    const set = loadDismissals(user.id, child.id);
    expect(set.has('welcome')).toBe(true);
    expect(set.has('welcome-dialog')).toBe(true);
    expect(set.has('stage-transition:6m')).toBe(true);
    expect(set.has('forbidden-reminder:miel')).toBe(true);
  });
});

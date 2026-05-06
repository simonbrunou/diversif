import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import {
  loadRecentEntries,
  loadDiversityMetrics,
  loadRepeatCandidates,
  loadDismissals,
  loadStreak,
  loadWeeklyRecap,
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

describe('loadStreak', () => {
  it('returns 0 when no entries exist', async () => {
    const { child } = await seedUserAndChild();
    expect(loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(0);
  });

  it('returns 0 when last entry is older than yesterday', async () => {
    const { user, child } = await seedUserAndChild();
    const f = seedFood({ name: 'A', category: 'legumes' });
    logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-05T10:00:00Z'),
      reaction: 'ras'
    });
    expect(loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(0);
  });

  it('counts a single same-day entry as a 1-day streak', async () => {
    const { user, child } = await seedUserAndChild();
    const f = seedFood({ name: 'A', category: 'legumes' });
    logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-10T08:00:00Z'),
      reaction: 'ras'
    });
    expect(loadStreak(child.id, new Date('2024-06-10T20:00:00Z'))).toBe(1);
  });

  it('allows the streak to start yesterday when nothing logged today yet', async () => {
    const { user, child } = await seedUserAndChild();
    const f = seedFood({ name: 'A', category: 'legumes' });
    logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-08T10:00:00Z'),
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-09T10:00:00Z'),
      reaction: 'ras'
    });
    expect(loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(2);
  });

  it('counts consecutive UTC days and stops at the first gap', async () => {
    const { user, child } = await seedUserAndChild();
    const f = seedFood({ name: 'A', category: 'legumes' });
    for (const day of [3, 4, 6, 8, 9, 10]) {
      const dd = String(day).padStart(2, '0');
      logEntry({
        childId: child.id,
        foodId: f.id,
        userId: user.id,
        givenAt: new Date(`2024-06-${dd}T10:00:00Z`),
        reaction: 'ras'
      });
    }
    // Today=10, yesterday=9, day before=8 → 3 in a row, then gap at day 7.
    expect(loadStreak(child.id, new Date('2024-06-10T15:00:00Z'))).toBe(3);
  });
});

describe('loadWeeklyRecap', () => {
  it('returns zeros when there are no entries', async () => {
    const { child } = await seedUserAndChild();
    const recap = loadWeeklyRecap(child.id, new Date('2024-06-10T12:00:00Z'));
    expect(recap).toEqual({ entries: 0, newFoods: 0, newAllergens: 0 });
  });

  it('counts entries, distinct first-introductions, and distinct first allergens within the window', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = seedFood({ name: 'Pomme', category: 'fruits' });
    const peanut = seedFood({
      name: 'Beurre cacahuète',
      category: 'allergenes',
      allergen: 'arachide'
    });
    const now = new Date('2024-06-10T12:00:00Z');
    const within = new Date('2024-06-08T10:00:00Z'); // 2d ago
    const outside = new Date('2024-05-15T10:00:00Z'); // ~26d ago
    // Carrot first introduced outside the window, then re-logged within → not new this week.
    logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: outside,
      reaction: 'ras'
    });
    logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });
    // Apple first introduced within the window → counts as new.
    logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });
    // Peanut introduced within the window → counts as new + new allergen.
    logEntry({
      childId: child.id,
      foodId: peanut.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });

    const recap = loadWeeklyRecap(child.id, now);
    expect(recap.entries).toBe(3); // 2 within + 1 within (the outside one excluded)
    expect(recap.newFoods).toBe(2); // apple + peanut
    expect(recap.newAllergens).toBe(1); // arachide
  });
});

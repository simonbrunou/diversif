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
  loadAnalyticsBuckets,
  loadCoparentActivity,
  loadStarterFoods,
  dismissReminder
} from './queries';
import { children, foods, foodEntries, users, tipDismissals } from '../db/schema';
import { eq } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedUserAndChild() {
  const user = (
    await testDb
      .insert(users)
      .values({
        email: 'p@example.com',
        passwordHash: 'pw',
        displayName: 'P',
        createdAt: new Date()
      })
      .returning()
  )[0];
  const child = (
    await testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy: user.id,
        createdAt: new Date()
      })
      .returning()
  )[0];
  return { user, child };
}

async function seedFood(opts: { name: string; category: string; allergen?: string | null }) {
  return (
    await testDb
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
  )[0];
}

async function logEntry(opts: {
  childId: number;
  foodId: number;
  userId: number;
  givenAt: Date;
  reaction: 'ras' | 'inconfort' | 'reaction';
}) {
  return (
    await testDb
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
  )[0];
}

beforeEach(async () => {
  await resetTestDb();
});

describe('loadRecentEntries', () => {
  it('returns entries within the day window, newest first', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = await seedFood({ name: 'Pomme', category: 'fruits' });
    const old = await seedFood({ name: 'Ancien', category: 'legumes' });
    const now = Date.now();
    await logEntry({
      childId: child.id,
      foodId: old.id,
      userId: user.id,
      givenAt: new Date(now - 30 * DAY_MS),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date(now - 2 * DAY_MS),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: new Date(now - 1 * DAY_MS),
      reaction: 'inconfort'
    });

    const out = await loadRecentEntries(child.id, 7);
    expect(out.map((e) => e.foodName)).toEqual(['Pomme', 'Carotte']);
    expect(out[0].category).toBe('fruits');
    expect(typeof out[0].givenAt).toBe('number');
  });

  it('returns empty when no entries match', async () => {
    const { child } = await seedUserAndChild();
    expect(await loadRecentEntries(child.id, 7)).toEqual([]);
  });
});

describe('loadDiversityMetrics', () => {
  it('counts distinct categories ignoring "autre"', async () => {
    const { user, child } = await seedUserAndChild();
    const veg = await seedFood({ name: 'Carotte', category: 'legumes' });
    const fruit = await seedFood({ name: 'Pomme', category: 'fruits' });
    const autre = await seedFood({ name: 'Autre', category: 'autre' });
    const now = Date.now();
    await logEntry({
      childId: child.id,
      foodId: veg.id,
      userId: user.id,
      givenAt: new Date(now - 1000),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: fruit.id,
      userId: user.id,
      givenAt: new Date(now - 2000),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: autre.id,
      userId: user.id,
      givenAt: new Date(now - 3000),
      reaction: 'ras'
    });

    const m = await loadDiversityMetrics(child.id, 11);
    expect(m.categoriesCovered).toBe(2);
    expect(m.totalCategories).toBe(11);
    expect(m.lastNewFoodAt).not.toBeNull();
    expect(m.repeatExposureCount).toBe(3);
  });

  it('returns zeros when no entries', async () => {
    const { child } = await seedUserAndChild();
    const m = await loadDiversityMetrics(child.id, 11);
    expect(m.categoriesCovered).toBe(0);
    expect(m.lastNewFoodAt).toBeNull();
    expect(m.repeatExposureCount).toBe(0);
  });

  it('returns lastNewFoodAt as the most-recent first-introduction across foods', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = await seedFood({ name: 'Pomme', category: 'fruits' });
    // Carrot first-introduced earlier; apple first-introduced later, then re-logged
    // even later (later re-log must NOT pull lastNewFoodAt forward : only first
    // introductions count).
    const carrotFirst = new Date('2024-05-01T10:00:00Z');
    const appleFirst = new Date('2024-05-10T10:00:00Z');
    const appleAgain = new Date('2024-05-20T10:00:00Z');
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: carrotFirst,
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: appleFirst,
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: appleAgain,
      reaction: 'ras'
    });

    const m = await loadDiversityMetrics(child.id, 11);
    expect(m.lastNewFoodAt).toBe(appleFirst.getTime());
  });

  it('excludes foods given >= 3 times from repeat exposure', async () => {
    const { user, child } = await seedUserAndChild();
    const food = await seedFood({ name: 'Carotte', category: 'legumes' });
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await logEntry({
        childId: child.id,
        foodId: food.id,
        userId: user.id,
        givenAt: new Date(now - i * 1000),
        reaction: 'ras'
      });
    }
    expect((await loadDiversityMetrics(child.id, 11)).repeatExposureCount).toBe(0);
  });

  it('excludes foods whose worst reaction is "reaction"', async () => {
    const { user, child } = await seedUserAndChild();
    const food = await seedFood({ name: 'Carotte', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: food.id,
      userId: user.id,
      givenAt: new Date(),
      reaction: 'reaction'
    });
    expect((await loadDiversityMetrics(child.id, 11)).repeatExposureCount).toBe(0);
  });
});

describe('loadRepeatCandidates', () => {
  it('returns foods needing follow-up, oldest first, capped by limit', async () => {
    const { user, child } = await seedUserAndChild();
    const a = await seedFood({ name: 'A', category: 'legumes' });
    const b = await seedFood({ name: 'B', category: 'fruits' });
    const c = await seedFood({ name: 'C', category: 'feculents' });
    const now = Date.now();
    await logEntry({
      childId: child.id,
      foodId: a.id,
      userId: user.id,
      givenAt: new Date(now - 10 * DAY_MS),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: b.id,
      userId: user.id,
      givenAt: new Date(now - 5 * DAY_MS),
      reaction: 'inconfort'
    });
    await logEntry({
      childId: child.id,
      foodId: c.id,
      userId: user.id,
      givenAt: new Date(now - 1 * DAY_MS),
      reaction: 'ras'
    });

    const out = await loadRepeatCandidates(child.id, 2);
    expect(out.length).toBe(2);
    expect(out[0].foodName).toBe('A'); // oldest first
    expect(out[1].foodName).toBe('B');
  });

  it('uses default limit of 5', async () => {
    const { child } = await seedUserAndChild();
    expect(await loadRepeatCandidates(child.id)).toEqual([]);
  });
});

describe('loadDismissals / dismissReminder', () => {
  it('returns an empty set when nothing dismissed', async () => {
    const { user, child } = await seedUserAndChild();
    expect((await loadDismissals(user.id, child.id)).size).toBe(0);
  });

  it('persists dismissal and reflects it on next read', async () => {
    const { user, child } = await seedUserAndChild();
    await dismissReminder(user.id, child.id, 'welcome');
    expect((await loadDismissals(user.id, child.id)).has('welcome')).toBe(true);
  });

  it('upserts dismissal on conflict (no duplicate row)', async () => {
    const { user, child } = await seedUserAndChild();
    await dismissReminder(user.id, child.id, 'high-risk-window');
    await dismissReminder(user.id, child.id, 'high-risk-window');
    const rows = await testDb.select().from(tipDismissals).where(eq(tipDismissals.userId, user.id));
    expect(rows.length).toBe(1);
  });

  it('honors TTL : info reminders expire after 30 days', async () => {
    const { user, child } = await seedUserAndChild();
    const longAgo = new Date(Date.now() - 31 * DAY_MS);
    await testDb.insert(tipDismissals).values({
      userId: user.id,
      childId: child.id,
      reminderKey: 'stale-diversity',
      dismissedAt: longAgo
    });
    expect((await loadDismissals(user.id, child.id)).has('stale-diversity')).toBe(false);
  });

  it('honors TTL : warn reminders expire after 90 days', async () => {
    const { user, child } = await seedUserAndChild();
    const longAgo = new Date(Date.now() - 91 * DAY_MS);
    await testDb.insert(tipDismissals).values({
      userId: user.id,
      childId: child.id,
      reminderKey: 'pending-allergen:oeuf',
      dismissedAt: longAgo
    });
    expect((await loadDismissals(user.id, child.id)).has('pending-allergen:oeuf')).toBe(false);
  });

  it('keeps warn reminders within TTL', async () => {
    const { user, child } = await seedUserAndChild();
    const recent = new Date(Date.now() - 5 * DAY_MS);
    await testDb.insert(tipDismissals).values({
      userId: user.id,
      childId: child.id,
      reminderKey: 'pending-allergen:oeuf',
      dismissedAt: recent
    });
    expect((await loadDismissals(user.id, child.id)).has('pending-allergen:oeuf')).toBe(true);
  });

  it('important reminders never expire', async () => {
    const { user, child } = await seedUserAndChild();
    const veryLongAgo = new Date(Date.now() - 365 * DAY_MS);
    await testDb.insert(tipDismissals).values([
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
    ]);
    const set = await loadDismissals(user.id, child.id);
    expect(set.has('welcome')).toBe(true);
    expect(set.has('welcome-dialog')).toBe(true);
    expect(set.has('stage-transition:6m')).toBe(true);
    expect(set.has('forbidden-reminder:miel')).toBe(true);
  });
});

describe('loadStreak', () => {
  it('returns 0 when no entries exist', async () => {
    const { child } = await seedUserAndChild();
    expect(await loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(0);
  });

  it('returns 0 when last entry is older than yesterday', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'A', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-05T10:00:00Z'),
      reaction: 'ras'
    });
    expect(await loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(0);
  });

  it('counts a single same-day entry as a 1-day streak', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'A', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-10T08:00:00Z'),
      reaction: 'ras'
    });
    expect(await loadStreak(child.id, new Date('2024-06-10T20:00:00Z'))).toBe(1);
  });

  it('allows the streak to start yesterday when nothing logged today yet', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'A', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-08T10:00:00Z'),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date('2024-06-09T10:00:00Z'),
      reaction: 'ras'
    });
    expect(await loadStreak(child.id, new Date('2024-06-10T12:00:00Z'))).toBe(2);
  });

  it('counts consecutive UTC days and stops at the first gap', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'A', category: 'legumes' });
    for (const day of [3, 4, 6, 8, 9, 10]) {
      const dd = String(day).padStart(2, '0');
      await logEntry({
        childId: child.id,
        foodId: f.id,
        userId: user.id,
        givenAt: new Date(`2024-06-${dd}T10:00:00Z`),
        reaction: 'ras'
      });
    }
    // Today=10, yesterday=9, day before=8 → 3 in a row, then gap at day 7.
    expect(await loadStreak(child.id, new Date('2024-06-10T15:00:00Z'))).toBe(3);
  });
});

describe('loadWeeklyRecap', () => {
  it('returns zeros when there are no entries', async () => {
    const { child } = await seedUserAndChild();
    const recap = await loadWeeklyRecap(child.id, new Date('2024-06-10T12:00:00Z'));
    expect(recap).toEqual({ entries: 0, newFoods: 0, newAllergens: 0 });
  });

  it('counts entries, distinct first-introductions, and distinct first allergens within the window', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = await seedFood({ name: 'Pomme', category: 'fruits' });
    const peanut = await seedFood({
      name: 'Beurre cacahuète',
      category: 'allergenes',
      allergen: 'arachide'
    });
    const now = new Date('2024-06-10T12:00:00Z');
    const within = new Date('2024-06-08T10:00:00Z'); // 2d ago
    const outside = new Date('2024-05-15T10:00:00Z'); // ~26d ago
    // Carrot first introduced outside the window, then re-logged within → not new this week.
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: outside,
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });
    // Apple first introduced within the window → counts as new.
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });
    // Peanut introduced within the window → counts as new + new allergen.
    await logEntry({
      childId: child.id,
      foodId: peanut.id,
      userId: user.id,
      givenAt: within,
      reaction: 'ras'
    });

    const recap = await loadWeeklyRecap(child.id, now);
    expect(recap.entries).toBe(3); // 2 within + 1 within (the outside one excluded)
    expect(recap.newFoods).toBe(2); // apple + peanut
    expect(recap.newAllergens).toBe(1); // arachide
  });
});

describe('loadAnalyticsBuckets', () => {
  it('returns N buckets with zeros when there are no entries', async () => {
    const { child } = await seedUserAndChild();
    const buckets = await loadAnalyticsBuckets(child.id, 4, new Date('2024-06-10T12:00:00Z'));
    expect(buckets).toHaveLength(4);
    for (const b of buckets) {
      expect(b.introductions).toBe(0);
      expect(b.reactions).toEqual({ ras: 0, inconfort: 0, reaction: 0 });
      expect(b.cumulativeCategories).toBe(0);
    }
    // Buckets are oldest-first.
    expect(buckets[0].weekStart).toBeLessThan(buckets[3].weekStart);
  });

  it('counts a re-log of an existing food as activity but not as a new introduction', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    // Older introduction (3 weeks ago).
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date('2024-05-20T10:00:00Z'),
      reaction: 'ras'
    });
    // Re-log within the most recent week.
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date('2024-06-08T10:00:00Z'),
      reaction: 'inconfort'
    });

    const buckets = await loadAnalyticsBuckets(child.id, 4, new Date('2024-06-10T12:00:00Z'));
    const totalIntros = buckets.reduce((s, b) => s + b.introductions, 0);
    expect(totalIntros).toBe(1); // only the original introduction counts

    const recent = buckets[buckets.length - 1];
    expect(recent.reactions.inconfort).toBe(1);
    expect(recent.introductions).toBe(0);
  });

  it("tracks cumulative categories monotonically and ignores 'autre'", async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = await seedFood({ name: 'Pomme', category: 'fruits' });
    const other = await seedFood({ name: 'Autre', category: 'autre' });

    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date('2024-05-20T10:00:00Z'),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: new Date('2024-06-01T10:00:00Z'),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: other.id,
      userId: user.id,
      givenAt: new Date('2024-06-05T10:00:00Z'),
      reaction: 'ras'
    });

    const buckets = await loadAnalyticsBuckets(child.id, 4, new Date('2024-06-10T12:00:00Z'));
    const series = buckets.map((b) => b.cumulativeCategories);
    // Monotonically non-decreasing.
    for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
    // Final value reflects 2 categories (legumes + fruits); 'autre' excluded.
    expect(series[series.length - 1]).toBe(2);
  });

  it('counts each reaction kind separately in the bucket totals', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'A', category: 'legumes' });
    const ts = new Date('2024-06-08T10:00:00Z');
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: ts,
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: ts,
      reaction: 'inconfort'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: ts,
      reaction: 'reaction'
    });
    const buckets = await loadAnalyticsBuckets(child.id, 2, new Date('2024-06-10T12:00:00Z'));
    const recent = buckets[buckets.length - 1];
    expect(recent.reactions).toEqual({ ras: 1, inconfort: 1, reaction: 1 });
  });

  it('cumulative categories include foods first introduced BEFORE the horizon', async () => {
    const { user, child } = await seedUserAndChild();
    // Two foods, both first introduced more than 4 weeks before "now" : i.e.
    // outside the chart's horizon. Reactions for those entries shouldn't
    // influence the visible buckets, but their categories must still appear
    // in the cumulative count of every bucket.
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const apple = await seedFood({ name: 'Pomme', category: 'fruits' });
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: new Date('2023-12-01T10:00:00Z'),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: apple.id,
      userId: user.id,
      givenAt: new Date('2024-01-15T10:00:00Z'),
      reaction: 'ras'
    });

    const buckets = await loadAnalyticsBuckets(child.id, 4, new Date('2024-06-10T12:00:00Z'));
    expect(buckets.every((b) => b.cumulativeCategories === 2)).toBe(true);
    // No introductions or reactions should fall inside the 4-week window.
    expect(buckets.reduce((s, b) => s + b.introductions, 0)).toBe(0);
    expect(
      buckets.reduce(
        (s, b) => s + b.reactions.ras + b.reactions.inconfort + b.reactions.reaction,
        0
      )
    ).toBe(0);
  });

  it('counts an entry at exactly horizonMs in the oldest bucket, not below', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'Carotte', category: 'legumes' });
    const weeks = 4;
    const now = new Date('2024-06-10T12:00:00Z');
    const horizonMs = now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000;
    // Entry at exactly horizonMs : should land in bucket 0 (the oldest visible
    // bucket) and contribute to its reaction count, never to a non-existent
    // earlier bucket.
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date(horizonMs),
      reaction: 'ras'
    });

    const buckets = await loadAnalyticsBuckets(child.id, weeks, now);
    expect(buckets[0].reactions.ras).toBe(1);
    expect(buckets[0].introductions).toBe(1);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i].reactions.ras).toBe(0);
      expect(buckets[i].introductions).toBe(0);
    }
  });

  it('does not double-count introductions when two rows share the exact givenAt', async () => {
    const { user, child } = await seedUserAndChild();
    const carrot = await seedFood({ name: 'Carotte', category: 'legumes' });
    const same = new Date('2024-06-08T10:00:00Z');
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: same,
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: carrot.id,
      userId: user.id,
      givenAt: same,
      reaction: 'ras'
    });

    const buckets = await loadAnalyticsBuckets(child.id, 2, new Date('2024-06-10T12:00:00Z'));
    const totalIntros = buckets.reduce((s, b) => s + b.introductions, 0);
    expect(totalIntros).toBe(1);
  });
});

describe('loadCoparentActivity', () => {
  async function seedSecondUser(email = 'partner@example.com', name = 'Partenaire') {
    return (
      await testDb
        .insert(users)
        .values({ email, passwordHash: 'pw', displayName: name, createdAt: new Date() })
        .returning()
    )[0];
  }

  it('returns empty when nobody else has logged anything', async () => {
    const { user, child } = await seedUserAndChild();
    const f = await seedFood({ name: 'Carotte', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date(),
      reaction: 'ras'
    });
    expect(await loadCoparentActivity(child.id, user.id)).toEqual([]);
  });

  it("excludes the current user's own entries even when others have logged too", async () => {
    const { user, child } = await seedUserAndChild();
    const partner = await seedSecondUser();
    const f = await seedFood({ name: 'Carotte', category: 'legumes' });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: user.id,
      givenAt: new Date(),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: partner.id,
      givenAt: new Date(),
      reaction: 'ras'
    });
    const out = await loadCoparentActivity(child.id, user.id);
    expect(out).toHaveLength(1);
    expect(out[0].loggedByName).toBe('Partenaire');
  });

  it('filters out entries older than the day window and orders newest-first', async () => {
    const { user, child } = await seedUserAndChild();
    const partner = await seedSecondUser();
    const f = await seedFood({ name: 'Pomme', category: 'fruits' });
    const now = Date.now();
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: partner.id,
      givenAt: new Date(now - 30 * DAY_MS),
      reaction: 'ras'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: partner.id,
      givenAt: new Date(now - 2 * DAY_MS),
      reaction: 'inconfort'
    });
    await logEntry({
      childId: child.id,
      foodId: f.id,
      userId: partner.id,
      givenAt: new Date(now - 1 * DAY_MS),
      reaction: 'ras'
    });
    const out = await loadCoparentActivity(child.id, user.id);
    expect(out).toHaveLength(2); // 30d-old one excluded
    expect(out[0].givenAt).toBeGreaterThan(out[1].givenAt);
  });

  it('caps the result at the requested limit', async () => {
    const { user, child } = await seedUserAndChild();
    const partner = await seedSecondUser();
    const f = await seedFood({ name: 'Pomme', category: 'fruits' });
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      await logEntry({
        childId: child.id,
        foodId: f.id,
        userId: partner.id,
        givenAt: new Date(now - i * 60_000),
        reaction: 'ras'
      });
    }
    expect(await loadCoparentActivity(child.id, user.id, 7, 3)).toHaveLength(3);
  });
});

describe('loadStarterFoods', () => {
  async function seedStarter(opts: {
    name: string;
    category: string;
    suggestedAgeMonths: number;
    isCustom?: boolean;
    allergen?: string | null;
  }) {
    return (
      await testDb
        .insert(foods)
        .values({
          name: opts.name,
          category: opts.category,
          isMajorAllergen: opts.allergen != null,
          allergenType: opts.allergen ?? null,
          suggestedAgeMonths: opts.suggestedAgeMonths,
          notes: null,
          isCustom: opts.isCustom ?? false,
          customForChildId: null
        })
        .returning()
    )[0];
  }

  it('returns an empty list when the catalog is empty', async () => {
    expect(await loadStarterFoods(6)).toEqual([]);
  });

  it('excludes foods whose suggested age is above the requested age', async () => {
    await seedStarter({ name: 'Carotte', category: 'legumes', suggestedAgeMonths: 4 });
    await seedStarter({ name: 'Tomate', category: 'legumes', suggestedAgeMonths: 8 });
    const out = await loadStarterFoods(5);
    expect(out.map((f) => f.name)).toEqual(['Carotte']);
  });

  it('clamps ages below 4 months up to 4 so the starter set is never empty', async () => {
    await seedStarter({ name: 'Carotte', category: 'legumes', suggestedAgeMonths: 4 });
    await seedStarter({ name: 'Pomme', category: 'fruits', suggestedAgeMonths: 5 });
    const out = await loadStarterFoods(0);
    expect(out.map((f) => f.name)).toEqual(['Carotte']);
  });

  it('includes 4-month foods when the requested age is exactly 4 (boundary)', async () => {
    await seedStarter({ name: 'Carotte', category: 'legumes', suggestedAgeMonths: 4 });
    await seedStarter({ name: 'Tomate', category: 'legumes', suggestedAgeMonths: 5 });
    const out = await loadStarterFoods(4);
    expect(out.map((f) => f.name)).toEqual(['Carotte']);
  });

  it('excludes custom foods', async () => {
    await seedStarter({ name: 'Carotte', category: 'legumes', suggestedAgeMonths: 4 });
    await seedStarter({
      name: 'Recette maison',
      category: 'legumes',
      suggestedAgeMonths: 4,
      isCustom: true
    });
    const out = await loadStarterFoods(6);
    expect(out.map((f) => f.name)).toEqual(['Carotte']);
  });

  it('orders by suggested age ascending, then name ascending, and honors the limit', async () => {
    await seedStarter({ name: 'Banane', category: 'fruits', suggestedAgeMonths: 6 });
    await seedStarter({ name: 'Pomme', category: 'fruits', suggestedAgeMonths: 4 });
    await seedStarter({ name: 'Carotte', category: 'legumes', suggestedAgeMonths: 4 });
    await seedStarter({ name: 'Courgette', category: 'legumes', suggestedAgeMonths: 5 });
    await seedStarter({ name: 'Poire', category: 'fruits', suggestedAgeMonths: 4 });

    const out = await loadStarterFoods(8, 3);
    expect(out.map((f) => f.name)).toEqual(['Carotte', 'Poire', 'Pomme']);
    expect(out.map((f) => f.suggestedAgeMonths)).toEqual([4, 4, 4]);
  });

  it('exposes category and allergen alongside the catalog row', async () => {
    await seedStarter({
      name: 'Œuf',
      category: 'proteines',
      suggestedAgeMonths: 6,
      allergen: 'oeuf'
    });
    const [first] = await loadStarterFoods(6);
    expect(first).toMatchObject({
      name: 'Œuf',
      category: 'proteines',
      suggestedAgeMonths: 6,
      allergenType: 'oeuf'
    });
    expect(typeof first.id).toBe('number');
  });

  it('defaults the limit to 4 when none is provided', async () => {
    for (let i = 0; i < 6; i++) {
      await seedStarter({ name: `Food${i}`, category: 'legumes', suggestedAgeMonths: 4 });
    }
    expect(await loadStarterFoods(6)).toHaveLength(4);
  });
});

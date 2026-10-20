import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../../test/db';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { children, tipDismissals, users } from '#lib/server/db/schema.js';
import { dismissReminder, loadDismissals } from './dismissals';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 4, 3, 12);

beforeEach(async () => {
  await resetTestDb();
});

async function seedUserAndChild() {
  const [user] = await testDb
    .insert(users)
    .values({ email: 'p@example.com', passwordHash: 'pw', displayName: 'P', createdAt: new Date() })
    .returning();
  const [child] = await testDb
    .insert(children)
    .values({ name: 'Bébé', birthDate: '2024-01-01', createdBy: user.id, createdAt: new Date() })
    .returning();
  return { user, child };
}

/** Stores a dismissal of `key` made `daysAgo` days before NOW. */
async function dismissedDaysAgo(userId: number, childId: number, key: string, daysAgo: number) {
  await testDb.insert(tipDismissals).values({
    userId,
    childId,
    reminderKey: key,
    dismissedAt: new Date(NOW - daysAgo * DAY_MS)
  });
}

describe('loadDismissals / dismissReminder', () => {
  it('returns an empty set when nothing dismissed', async () => {
    const { user, child } = await seedUserAndChild();
    expect((await loadDismissals(user.id, child.id, NOW)).size).toBe(0);
  });

  it('persists dismissal and reflects it on next read', async () => {
    const { user, child } = await seedUserAndChild();
    await dismissReminder(user.id, child.id, 'welcome');
    // dismissReminder stamps the real clock, so read at the real clock too.
    expect((await loadDismissals(user.id, child.id, Date.now())).has('welcome')).toBe(true);
  });

  it('upserts dismissal on conflict (no duplicate row)', async () => {
    const { user, child } = await seedUserAndChild();
    await dismissReminder(user.id, child.id, 'pending-allergen:oeuf');
    await dismissReminder(user.id, child.id, 'pending-allergen:oeuf');
    const rows = await testDb.select().from(tipDismissals).where(eq(tipDismissals.userId, user.id));
    expect(rows.length).toBe(1);
  });

  it('drops a dismissal once its severity TTL has run out at `now`', async () => {
    const { user, child } = await seedUserAndChild();
    await dismissedDaysAgo(user.id, child.id, 'stale-diversity', 31); // info: 30 days
    await dismissedDaysAgo(user.id, child.id, 'repeat-exposure:3', 29);
    await dismissedDaysAgo(user.id, child.id, 'pending-allergen:oeuf', 91); // warn: 90 days
    await dismissedDaysAgo(user.id, child.id, 'pending-allergen:lait', 5);
    await dismissedDaysAgo(user.id, child.id, 'observation-window:42', 31);
    await dismissedDaysAgo(user.id, child.id, 'welcome', 365); // important: never
    await dismissedDaysAgo(user.id, child.id, 'welcome-dialog', 365);
    await dismissedDaysAgo(user.id, child.id, 'stage-transition:6m', 365);
    await dismissedDaysAgo(user.id, child.id, 'forbidden-reminder:miel', 365);
    expect([...(await loadDismissals(user.id, child.id, NOW))].sort()).toEqual([
      'forbidden-reminder:miel',
      'observation-window:42',
      'pending-allergen:lait',
      'repeat-exposure:3',
      'stage-transition:6m',
      'welcome',
      'welcome-dialog'
    ]);
  });

  it("reads only this viewer's dismissals for this child", async () => {
    const { user, child } = await seedUserAndChild();
    const [sibling] = await testDb
      .insert(children)
      .values({ name: 'Aîné', birthDate: '2023-01-01', createdBy: user.id, createdAt: new Date() })
      .returning();
    const [partner] = await testDb
      .insert(users)
      .values({
        email: 'q@example.com',
        passwordHash: 'pw',
        displayName: 'Q',
        createdAt: new Date()
      })
      .returning();
    await dismissReminder(user.id, sibling.id, 'welcome');
    await dismissReminder(partner.id, child.id, 'stale-diversity');
    expect((await loadDismissals(user.id, child.id, Date.now())).size).toBe(0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

describe('child/[id]/guide load', () => {
  it('returns ageMonths and currentStageId for the child', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    const event = makeRouteEvent({
      user: safeUser(u),
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(typeof out.ageMonths).toBe('number');
    expect(out.currentStageId).toMatch(/4-6|6-9|9-12|12-36/);
  });

  it('returns 4-6 stage for a very young child', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const recent = new Date();
    const dateStr = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, '0')}-${String(recent.getDate()).padStart(2, '0')}`;
    const event = makeRouteEvent({
      user: safeUser(u),
      parent: async () => ({ child: { id: c.id, birthDate: dateStr } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toBe('4-6');
  });

  it('returns stages, suggestions, todayTip and tipDismissed', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    const event = makeRouteEvent({
      user: safeUser(u),
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(Array.isArray(out.stages)).toBe(true);
    expect(out.stages).toHaveLength(4);
    expect(out.stages[0]).toMatchObject({
      id: '4-6',
      title: expect.any(String),
      oneLiner: expect.any(String),
      principles: expect.any(Array),
      focus: expect.any(Array),
      textures: expect.any(String),
      milkTarget: expect.any(String),
      redFlags: expect.any(Array),
      sources: expect.any(Array)
    });

    expect(Array.isArray(out.suggestions)).toBe(true);
    expect(out.todayTip).toMatchObject({
      id: 'tip-allergen-eggs',
      title: expect.any(String),
      body: expect.any(String)
    });
    expect(typeof out.tipDismissed).toBe('boolean');
    expect(out.tipDismissed).toBe(false);
  });

  it('reflects tipDismissed=true when the tip has been dismissed', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    // Insert a dismissal for the today tip
    const { tipDismissals } = await import('$lib/server/db/schema');
    await testDb.insert(tipDismissals).values({
      userId: u.id,
      childId: c.id,
      reminderKey: 'tip-allergen-eggs',
      dismissedAt: new Date()
    });

    const event = makeRouteEvent({
      user: safeUser(u),
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.tipDismissed).toBe(true);
  });

  it('maps food entries into the recent list for the suggestion engine', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    const { foodEntries, foods } = await import('$lib/server/db/schema');
    const [pear] = await testDb
      .insert(foods)
      .values({
        name: 'Poire',
        category: 'fruits',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId: pear.id,
      givenAt: new Date('2026-05-01T12:00:00Z'),
      reaction: 'ras',
      notes: null,
      loggedBy: u.id,
      createdAt: new Date()
    });

    const event = makeRouteEvent({
      user: safeUser(u),
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(Array.isArray(out.suggestions)).toBe(true);
  });

  it('currentStageId reflects child age', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    const event = makeRouteEvent({
      user: safeUser(u),
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: '2022-01-01' } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toBe('12-36');
  });
});

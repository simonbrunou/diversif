import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foodEntries, foods, tipDismissals } from '$lib/server/db/schema';
import { load, actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function setup(opts: { entries?: number } = {}) {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = (
    await testDb
      .insert(foods)
      .values({
        name: 'Carotte',
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
  if (opts.entries) {
    for (let i = 0; i < opts.entries; i++) {
      await testDb.insert(foodEntries).values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(Date.now() - i * 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      });
    }
  }
  return { u, c, m, food };
}

describe('child/[id] +page.server load', () => {
  it('redirects guests', async () => {
    const { c } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: String(c.id) }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('redirects guests to /login even when the URL has a malformed id', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: 'not-a-number' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('rejects non-numeric child IDs with 404 before any query or membership check', async () => {
    const { u, m } = await setup();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [m],
          params: { id: 'not-a-number' },
          parent: async () => {
            throw new Error('parent() must not be reached when childId is invalid');
          }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('rejects authenticated users without membership with 403', async () => {
    const { c } = await setup();
    const intruder = await seedUser({ email: 'intruder@example.com' });
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(intruder),
          memberships: [],
          params: { id: String(c.id) },
          parent: async () => ({
            child: {
              id: c.id,
              name: c.name,
              birthDate: c.birthDate,
              createdAt: c.createdAt.getTime()
            }
          })
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
  });

  it('returns dashboard data with no entries', async () => {
    const { u, c, m } = await setup();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent).toEqual([]);
    expect(out.stats.foodsIntroduced).toBe(0);
    expect(out.stats.weekCount).toBe(0);
    expect(out.showWelcomeDialog).toBe(true);
    expect(out.starterFoods.length).toBeGreaterThan(0);
    expect(out.starterFoods[0]).toMatchObject({ name: 'Carotte', category: 'legumes' });
  });

  it('returns dashboard data with entries and hides welcome dialog', async () => {
    const { u, c, m } = await setup({ entries: 3 });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent.length).toBe(3);
    expect(out.stats.foodsIntroduced).toBe(1);
    expect(out.showWelcomeDialog).toBe(false);
    expect(out.starterFoods).toEqual([]);
  });

  it('keeps starterFoods populated even after the welcome dialog is dismissed', async () => {
    const { u, c, m } = await setup();
    await testDb.insert(tipDismissals).values({
      userId: u.id,
      childId: c.id,
      reminderKey: 'welcome-dialog',
      dismissedAt: new Date()
    });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.showWelcomeDialog).toBe(false);
    expect(out.starterFoods.length).toBeGreaterThan(0);
  });

  it('shows "Compte supprimé" for entries whose logger was deleted', async () => {
    const { u, c, m, food } = await setup();
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date(),
      reaction: 'ras',
      notes: null,
      loggedBy: null,
      createdAt: new Date()
    });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent).toHaveLength(1);
    expect(out.recent[0].loggedByName).toBe('Compte supprimé');
  });

  it('marks reactions in the allergen summary', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const allergen = (
      await testDb
        .insert(foods)
        .values({
          name: 'Œuf',
          category: 'oeufs',
          isMajorAllergen: true,
          allergenType: 'oeuf',
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    // Two entries: ras then inconfort — worst should be inconfort.
    await testDb.insert(foodEntries).values([
      {
        childId: c.id,
        foodId: allergen.id,
        givenAt: new Date(Date.now() - 86400_000),
        reaction: 'ras',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      },
      {
        childId: c.id,
        foodId: allergen.id,
        givenAt: new Date(),
        reaction: 'inconfort',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      }
    ]);
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.stats.allergens.introduced).toBe(1);
    expect(out.stats.allergens.inconfort).toBe(1);
  });

  it('upgrades worst-allergen reaction when reaction > inconfort encountered', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const allergen = (
      await testDb
        .insert(foods)
        .values({
          name: 'Arachide',
          category: 'allergenes',
          isMajorAllergen: true,
          allergenType: 'arachide',
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    await testDb.insert(foodEntries).values([
      {
        childId: c.id,
        foodId: allergen.id,
        givenAt: new Date(Date.now() - 86400_000),
        reaction: 'inconfort',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      },
      {
        childId: c.id,
        foodId: allergen.id,
        givenAt: new Date(),
        reaction: 'reaction',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      }
    ]);
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.stats.allergens.reaction).toBe(1);
  });

  it('surfaces an observation-window reminder with cta href when a non-RAS entry exists within 48 h', async () => {
    const { u, c, m, food } = await setup();
    const [entry] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        reaction: 'inconfort',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    const obsReminder = out.reminders.find((r) => r.key.startsWith('observation-window:'));
    expect(obsReminder).toBeDefined();
    expect(obsReminder!.cta?.href).toBe(`/child/${c.id}/foods/${entry.id}`);
    expect(obsReminder!.severity).toBe('warn');
  });

  it('does not surface observation-window reminder when non-RAS entry is older than 48 h', async () => {
    const { u, c, m, food } = await setup();
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId: food.id,
      givenAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      reaction: 'inconfort',
      notes: null,
      loggedBy: u.id,
      createdAt: new Date()
    });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    const obsReminder = out.reminders.find((r) => r.key.startsWith('observation-window:'));
    expect(obsReminder).toBeUndefined();
  });

  it('does not surface observation-window reminder when all entries are RAS', async () => {
    const { u, c, m } = await setup({ entries: 2 });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: {
            id: c.id,
            name: c.name,
            birthDate: c.birthDate,
            createdAt: c.createdAt.getTime()
          }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    const obsReminder = out.reminders.find((r) => r.key.startsWith('observation-window:'));
    expect(obsReminder).toBeUndefined();
  });
});

describe('?/optInBento action', () => {
  it('sets bento=1 cookie and 303 redirects back to /child/[id]', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    const m_row = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m_row],
      params: { id: String(c.id) },
      request: new Request('http://localhost/', { method: 'POST' })
    });
    await expect(
      actions.optInBento(event as unknown as Parameters<typeof actions.optInBento>[0])
    ).rejects.toMatchObject({ status: 303 });
    expect(event.cookies.get('bento')).toBe('1');
  });
});

describe('child/[id] dismissReminder action', () => {
  it('rejects empty key', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { reminderKey: '' }
    });
    const r = (await actions.dismissReminder!(
      event as unknown as Parameters<NonNullable<typeof actions.dismissReminder>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('rejects long key', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { reminderKey: 'x'.repeat(101) }
    });
    const r = (await actions.dismissReminder!(
      event as unknown as Parameters<NonNullable<typeof actions.dismissReminder>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('persists the dismissal on success', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { reminderKey: 'welcome' }
    });
    const r = (await actions.dismissReminder!(
      event as unknown as Parameters<NonNullable<typeof actions.dismissReminder>>[0]
    )) as { ok: boolean };
    expect(r.ok).toBe(true);
    const rows = await testDb.select().from(tipDismissals);
    expect(rows.length).toBe(1);
    expect(rows[0].reminderKey).toBe('welcome');
  });
});

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

beforeEach(() => {
  resetTestDb();
});

async function setup(opts: { entries?: number } = {}) {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
  const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = testDb
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
    .all()[0];
  if (opts.entries) {
    for (let i = 0; i < opts.entries; i++) {
      testDb
        .insert(foodEntries)
        .values({
          childId: c.id,
          foodId: food.id,
          givenAt: new Date(Date.now() - i * 86400_000),
          reaction: 'ras',
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        })
        .run();
    }
  }
  return { u, c, m, food };
}

describe('child/[id] +page.server load', () => {
  it('redirects guests', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: null,
          params: { id: '1' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('returns dashboard data with no entries', async () => {
    const { u, c, m } = await setup();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: { id: c.id, name: c.name, birthDate: c.birthDate }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent).toEqual([]);
    expect(out.stats.foodsIntroduced).toBe(0);
    expect(out.stats.weekCount).toBe(0);
    expect(out.showWelcomeDialog).toBe(true);
  });

  it('returns dashboard data with entries and hides welcome dialog', async () => {
    const { u, c, m } = await setup({ entries: 3 });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: { id: c.id, name: c.name, birthDate: c.birthDate }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent.length).toBe(3);
    expect(out.stats.foodsIntroduced).toBe(1);
    expect(out.showWelcomeDialog).toBe(false);
  });

  it('shows "Compte supprimé" for entries whose logger was deleted', async () => {
    const { u, c, m, food } = await setup();
    testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(),
        reaction: 'ras',
        notes: null,
        loggedBy: null,
        createdAt: new Date()
      })
      .run();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: { id: c.id, name: c.name, birthDate: c.birthDate }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.recent).toHaveLength(1);
    expect(out.recent[0].loggedByName).toBe('Compte supprimé');
  });

  it('marks reactions in the allergen summary', async () => {
    const u = await seedUser();
    const c = seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const allergen = testDb
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
      .all()[0];
    // Two entries: ras then inconfort — worst should be inconfort.
    testDb
      .insert(foodEntries)
      .values([
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
      ])
      .run();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: { id: c.id, name: c.name, birthDate: c.birthDate }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.stats.allergens.introduced).toBe(1);
    expect(out.stats.allergens.inconfort).toBe(1);
  });

  it('upgrades worst-allergen reaction when reaction > inconfort encountered', async () => {
    const u = await seedUser();
    const c = seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
    const m = seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const allergen = testDb
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
      .all()[0];
    testDb
      .insert(foodEntries)
      .values([
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
      ])
      .run();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        parent: async () => ({
          child: { id: c.id, name: c.name, birthDate: c.birthDate }
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.stats.allergens.reaction).toBe(1);
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
    const rows = testDb.select().from(tipDismissals).all();
    expect(rows.length).toBe(1);
    expect(rows[0].reminderKey).toBe('welcome');
  });
});

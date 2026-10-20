import { beforeEach, describe, expect, it } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership
} from '../../../../test/route';
import { seedFood, seedRepasChild } from '../../../../test/repas';
import { foodEntries, preparedMeals } from '#lib/server/db/schema.js';
import { load, actions } from './+page.server';

// The repas rules live in src/lib/server/repas (tested there). These tests
// cover the route adapter only: what the loader returns, and how the action
// turns the module's result into a redirect or a fail().

beforeEach(async () => {
  await resetTestDb();
});

async function setup() {
  const seeded = await seedRepasChild();
  const membership = await seedMembership({ userId: seeded.user.id, childId: seeded.child.id });
  const event = (opts: Parameters<typeof makeRouteEvent>[0] = {}) =>
    makeRouteEvent({
      user: safeUser(seeded.user),
      memberships: [membership],
      params: { id: String(seeded.child.id) },
      ...opts
    });
  return { ...seeded, event };
}

type LoadEvent = Parameters<typeof load>[0];
type ActionEvent = Parameters<typeof actions.default>[0];

describe('child/[id]/log load', () => {
  it('redirects guests', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null, params: { id: '1' } }) as unknown as LoadEvent)
    );
    expect(r.kind).toBe('redirect');
  });

  it('returns the visible aliments, the ones already tried and the saved plats préparés', async () => {
    const { event, child, user, carotte } = await setup();
    const sibling = await seedChild({ createdBy: user.id });
    const mine = await seedFood({
      name: 'Mon plat',
      category: 'autre',
      customForChildId: child.id
    });
    await seedFood({
      name: 'Plat ailleurs',
      category: 'autre',
      customForChildId: sibling.id
    });
    await testDb.insert(foodEntries).values({
      childId: child.id,
      foodId: mine.id,
      givenAt: new Date('2024-05-01T10:00:00Z'),
      reaction: 'ras',
      loggedBy: user.id,
      createdAt: new Date()
    });
    await testDb.insert(preparedMeals).values({
      childId: child.id,
      brand: 'Babybio',
      name: 'Légumes et riz',
      ingredientFoodIds: [carotte.id],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const data = await load(event() as unknown as LoadEvent);

    expect(data.foods.map((f) => f.name)).toEqual(['Carotte', 'Mon plat']);
    expect(data.introducedFoodIds).toEqual([mine.id]);
    expect(data.preparedMeals).toMatchObject([
      { brand: 'Babybio', name: 'Légumes et riz', foodIds: [carotte.id] }
    ]);
  });
});

describe('child/[id]/log default action', () => {
  const fields = (foodId: number) => ({
    foodId: String(foodId),
    givenAt: '2024-06-01T10:00:00.000Z',
    reaction: 'ras'
  });

  it('redirects to the dashboard with the milestones, in the visitor’s locale', async () => {
    const { event, child, carotte } = await setup();
    const r = await captureFlow(() =>
      actions.default(
        event({ formData: fields(carotte.id), locale: 'en' }) as unknown as ActionEvent
      )
    );
    expect(r).toEqual({
      kind: 'redirect',
      status: 303,
      location: `/en/child/${child.id}?logged=1&first=1&categories=1&prevCategories=0`
    });
  });

  it('returns the refusal as a fail() with its status and error key', async () => {
    const { event, carotte } = await setup();
    const refused = await actions.default(
      event({
        formData: { givenAt: fields(carotte.id).givenAt, reaction: 'ras' }
      }) as unknown as ActionEvent
    );
    expect(refused).toMatchObject({ status: 400, data: { errorKey: 'errorsLogNoFoodSelected' } });
  });
});

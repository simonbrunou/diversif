import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, safeUser } from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { eq } from 'drizzle-orm';
import { children } from '$lib/server/db/schema';
import { actions } from './+page.server';
import { setup } from './settings-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
});

// setDiet takes multiple `diet` values from the same form field, which the
// shared makeRouteEvent({ formData }) shorthand can't express (one value per
// key). Build the multi-value FormData body directly and swap it onto the
// event returned by makeRouteEvent, reusing its cookies/locals/params scaffolding.
function eventWithDiet(
  user: Parameters<typeof safeUser>[0],
  memberships: Parameters<typeof makeRouteEvent>[0] extends { memberships?: infer M } ? M : never,
  childId: number,
  values: string[]
) {
  const event = makeRouteEvent({
    user: safeUser(user),
    memberships,
    params: { id: String(childId) }
  });
  const form = new FormData();
  for (const v of values) form.append('diet', v);
  event.request = new Request(event.url, { method: 'POST', body: form });
  return event;
}

describe('settings setDiet action', () => {
  it('drops unknown values, persisting only known DIET_EXCLUSIONS', async () => {
    const { u, c, m } = await setup();
    const event = eventWithDiet(u, [m], c.id, ['porc', 'bogus']);

    await actions.setDiet!(event as unknown as Parameters<NonNullable<typeof actions.setDiet>>[0]);

    const fresh = (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0];
    expect(fresh?.dietaryExclusions).toEqual(['porc']);
  });

  it('member-allowed : a non-owner member can set diet (not requireOwnership)', async () => {
    const { u, c, m } = await setup({ role: 'member' });
    const event = eventWithDiet(u, [m], c.id, ['vegetarien', 'sans_poisson']);

    const r = await actions.setDiet!(
      event as unknown as Parameters<NonNullable<typeof actions.setDiet>>[0]
    );

    expect(r).toBeTruthy();
    const fresh = (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0];
    expect(fresh?.dietaryExclusions).toEqual(['vegetarien', 'sans_poisson']);
  });
});

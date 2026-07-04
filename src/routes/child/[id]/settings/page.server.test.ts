import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { eq } from 'drizzle-orm';
import { children } from '$lib/server/db/schema';
import { actions, load } from './+page.server';
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

  it('rejects a member of child A calling setDiet with child B’s id, leaving B unchanged (cross-child isolation)', async () => {
    // Defense-in-depth: the isolation audit found requireChildContext already
    // enforces this transitively, but a per-handler test locks the invariant
    // against a future refactor that bypasses the guard.
    const { u: userA, m: membershipA } = await setup(); // owner of child A

    const ownerB = await seedUser({ email: 'owner-b@example.com' });
    const childB = await seedChild({ createdBy: ownerB.id, name: 'Bébé B' });
    await seedMembership({ userId: ownerB.id, childId: childB.id, role: 'owner' });
    // Non-default starting value so a silent overwrite is observable.
    await testDb
      .update(children)
      .set({ dietaryExclusions: ['porc'] })
      .where(eq(children.id, childB.id));

    const event = eventWithDiet(userA, [membershipA], childB.id, ['vegetarien']);
    const r = await captureFlow(() =>
      actions.setDiet!(event as unknown as Parameters<NonNullable<typeof actions.setDiet>>[0])
    );

    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);

    const freshB = (
      await testDb.select().from(children).where(eq(children.id, childB.id)).limit(1)
    )[0];
    expect(freshB?.dietaryExclusions).toEqual(['porc']); // untouched by the rejected call
  });
});

describe('settings load dietaryExclusions', () => {
  it('re-validates on read : drops stale/foreign tags left in the JSON column', async () => {
    const { u, c, m } = await setup();
    // Write a value that bypasses the setDiet action's write-side validation
    // (e.g. a future enum rename, a manual DB edit, or a restore) directly into
    // the column, then prove the load re-filters it rather than trusting the DB.
    await testDb
      .update(children)
      .set({ dietaryExclusions: ['porc', 'stale'] as never })
      .where(eq(children.id, c.id));

    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );

    expect(out.dietaryExclusions).toEqual(['porc']);
  });
});

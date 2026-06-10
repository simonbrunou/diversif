import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../test/db';
import { makeRouteEvent, safeUser, seedChild, seedMembership, seedUser } from '../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { load } from './+layout.server';

beforeEach(async () => {
  await resetTestDb();
});

describe('+layout.server load', () => {
  it('returns no children when user is logged out', async () => {
    const out = await load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0]);
    expect(out.user).toBeNull();
    expect(out.children).toEqual([]);
  });

  it('returns no children when user has no memberships', async () => {
    const u = await seedUser();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.user?.id).toBe(u.id);
    expect(out.children).toEqual([]);
  });

  it('returns memberships joined with children rows', async () => {
    const u = await seedUser();
    const c1 = await seedChild({ createdBy: u.id, name: 'Alice' });
    const c2 = await seedChild({ createdBy: u.id, name: 'Bob' });
    const m1 = await seedMembership({ userId: u.id, childId: c1.id, role: 'owner' });
    const m2 = await seedMembership({ userId: u.id, childId: c2.id, role: 'member' });

    const out = await load(
      makeRouteEvent({ user: safeUser(u), memberships: [m1, m2] }) as unknown as Parameters<
        typeof load
      >[0]
    );
    expect(out.children.map((c) => c.name).sort()).toEqual(['Alice', 'Bob']);
    expect(out.children.find((c) => c.name === 'Alice')?.role).toBe('owner');
    expect(out.children.find((c) => c.name === 'Bob')?.role).toBe('member');
  });

  it('drops orphan memberships (no matching children row)', async () => {
    const u = await seedUser();
    const fakeMembership = {
      userId: u.id,
      childId: 999,
      role: 'owner' as const,
      createdAt: new Date()
    };
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [fakeMembership]
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.children).toEqual([]);
  });

  // currentChildId comes from `params.id` (the router resolves it post-reroute,
  // so locale prefixes never reach the load, and the static /child/new route
  // shadows [id]). The load only validates the digits-only shape.
  it('returns null currentChildId when the route has no id param', async () => {
    const out = await load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0]);
    expect(out.currentChildId).toBeNull();
  });

  it('extracts currentChildId from the id param', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, name: 'Léo' });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });

    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentChildId).toBe(String(c.id));
  });

  it('returns null currentChildId for a non-numeric id param', async () => {
    for (const id of ['new', '12abc', '']) {
      const out = await load(
        makeRouteEvent({ user: null, params: { id } }) as unknown as Parameters<typeof load>[0]
      );
      expect(out.currentChildId).toBeNull();
    }
  });
});

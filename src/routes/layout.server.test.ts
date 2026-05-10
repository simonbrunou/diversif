import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../test/db';
import { makeRouteEvent, safeUser, seedChild, seedMembership, seedUser } from '../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { foods } from '$lib/server/db/schema';
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

  it('returns bento=false and empty foods for a non-bento visitor', async () => {
    const out = await load(
      makeRouteEvent({ user: null, url: 'http://localhost/' }) as unknown as Parameters<
        typeof load
      >[0]
    );
    expect(out.bento).toBe(false);
    expect(out.currentChildId).toBeNull();
    expect(out.foods).toEqual([]);
  });

  it('flags bento=true via cookie override even without a user', async () => {
    const event = makeRouteEvent({ user: null, url: 'http://localhost/' });
    event.cookies.set('bento', '1');
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.bento).toBe(true);
    expect(out.foods).toEqual([]);
  });

  it('loads the foods catalog on a /child/:id path when bento is on', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, name: 'Léo' });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    await testDb.insert(foods).values([
      { name: 'Poire', category: 'fruits', suggestedAgeMonths: 4 },
      { name: 'Banane', category: 'fruits', suggestedAgeMonths: 4 }
    ]);

    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      url: `http://localhost/child/${c.id}`
    });
    event.cookies.set('bento', '1');

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.bento).toBe(true);
    expect(out.currentChildId).toBe(String(c.id));
    expect(out.foods).toHaveLength(2);
    expect(out.foods[0]).toEqual({ id: expect.any(String), label: expect.any(String) });
  });

  it('skips the foods query when path child id is non-numeric', async () => {
    const event = makeRouteEvent({ url: 'http://localhost/child/abc' });
    event.cookies.set('bento', '1');
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentChildId).toBe('abc');
    expect(out.foods).toEqual([]);
  });

  it('skips the foods query when bento is on but no user is logged in', async () => {
    const event = makeRouteEvent({ user: null, url: 'http://localhost/child/5' });
    event.cookies.set('bento', '1');
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.bento).toBe(true);
    expect(out.currentChildId).toBe('5');
    expect(out.foods).toEqual([]);
  });
});

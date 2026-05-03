import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../test/db';
import { makeRouteEvent, safeUser, seedChild, seedMembership, seedUser } from '../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+layout.server';

beforeEach(() => {
  resetTestDb();
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
    const c1 = seedChild({ createdBy: u.id, name: 'Alice' });
    const c2 = seedChild({ createdBy: u.id, name: 'Bob' });
    const m1 = seedMembership({ userId: u.id, childId: c1.id, role: 'owner' });
    const m2 = seedMembership({ userId: u.id, childId: c2.id, role: 'member' });

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
});

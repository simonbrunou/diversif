import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { children, invitations, memberships } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function setup(opts: { role?: 'owner' | 'member' } = {}) {
  const u = await seedUser();
  const c = seedChild({ createdBy: u.id, name: 'Bébé' });
  const m = seedMembership({ userId: u.id, childId: c.id, role: opts.role ?? 'owner' });
  return { u, c, m };
}

describe('settings load', () => {
  it('errors when not authenticated', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({ user: null, params: { id: '1' } }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('returns members + active invitations + role for the user', async () => {
    const { u, c, m } = await setup();
    testDb
      .insert(invitations)
      .values([
        {
          code: 'BEBE-AAAA',
          childId: c.id,
          createdBy: u.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400_000),
          usedAt: null,
          usedBy: null
        },
        {
          // Expired — should be excluded.
          code: 'BEBE-BBBB',
          childId: c.id,
          createdBy: u.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() - 86400_000),
          usedAt: null,
          usedBy: null
        },
        {
          // Used — should be excluded.
          code: 'BEBE-CCCC',
          childId: c.id,
          createdBy: u.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86400_000),
          usedAt: new Date(),
          usedBy: u.id
        }
      ])
      .run();

    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.members.length).toBe(1);
    expect(out.invitations.map((i) => i.code)).toEqual(['BEBE-AAAA']);
    expect(out.role).toBe('owner');
  });
});

describe('settings updateChild action', () => {
  it('owner-only — fails for member', async () => {
    const { u, c, m } = await setup({ role: 'member' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { name: 'Lulu', birthDate: '2024-01-01' }
    });
    const r = await captureFlow(() =>
      actions.updateChild!(
        event as unknown as Parameters<NonNullable<typeof actions.updateChild>>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
  });

  it('fails on invalid birth date', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { name: 'Lulu', birthDate: '2024-99-99' }
    });
    const r = (await actions.updateChild!(
      event as unknown as Parameters<NonNullable<typeof actions.updateChild>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('fails on empty name', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { name: '', birthDate: '2024-01-01' }
    });
    const r = (await actions.updateChild!(
      event as unknown as Parameters<NonNullable<typeof actions.updateChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('updates the child on success', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { name: '  Lulu  ', birthDate: '2024-02-15' }
    });
    const r = (await actions.updateChild!(
      event as unknown as Parameters<NonNullable<typeof actions.updateChild>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const fresh = testDb.select().from(children).where(eq(children.id, c.id)).get();
    expect(fresh?.name).toBe('Lulu');
    expect(fresh?.birthDate).toBe('2024-02-15');
  });
});

describe('settings createInvitation action', () => {
  it('inserts an invitation with a generated code', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { success: string; code: string };
    expect(r.code).toMatch(/^BEBE-/);
    const stored = testDb.select().from(invitations).where(eq(invitations.code, r.code)).get();
    expect(stored).toBeDefined();
  });
});

describe('settings revokeInvitation action', () => {
  it('fails when code missing', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {}
    });
    const r = (await actions.revokeInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.revokeInvitation>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('deletes the matching invitation', async () => {
    const { u, c, m } = await setup();
    testDb
      .insert(invitations)
      .values({
        code: 'BEBE-ZZZZ',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        usedAt: null,
        usedBy: null
      })
      .run();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { code: 'BEBE-ZZZZ' }
    });
    const r = (await actions.revokeInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.revokeInvitation>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const stored = testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ZZZZ')).get();
    expect(stored).toBeUndefined();
  });
});

describe('settings removeMember action', () => {
  it('fails on non-numeric userId', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: 'abc' }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('refuses self-removal', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: String(u.id) }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/vous-même/i);
  });

  it('removes another member', async () => {
    const { u, c, m } = await setup();
    const other = await seedUser({ email: 'other@example.com' });
    seedMembership({ userId: other.id, childId: c.id, role: 'member' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: String(other.id) }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const remaining = testDb.select().from(memberships).where(eq(memberships.childId, c.id)).all();
    expect(remaining.find((mm) => mm.userId === other.id)).toBeUndefined();
  });
});

describe('settings leaveChild action', () => {
  it('owner cannot leave', async () => {
    const { u, c, m } = await setup({ role: 'owner' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = (await actions.leaveChild!(
      event as unknown as Parameters<NonNullable<typeof actions.leaveChild>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('member can leave + redirects /', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const c = seedChild({ createdBy: owner.id });
    seedMembership({ userId: owner.id, childId: c.id, role: 'owner' });
    const m = seedMembership({ userId: me.id, childId: c.id, role: 'member' });
    const event = makeRouteEvent({
      user: safeUser(me),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = await captureFlow(() =>
      actions.leaveChild!(event as unknown as Parameters<NonNullable<typeof actions.leaveChild>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
    const remaining = testDb.select().from(memberships).where(eq(memberships.userId, me.id)).all();
    expect(remaining.length).toBe(0);
  });
});

describe('settings deleteChild action', () => {
  it('fails when confirmName mismatches', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmName: 'Wrong' }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('redirects when child no longer exists', async () => {
    const { u, c, m } = await setup();
    testDb.delete(children).where(eq(children.id, c.id)).run();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmName: 'Bébé' }
    });
    const r = await captureFlow(() =>
      actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
  });

  it('deletes the child and redirects /', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmName: 'Bébé' }
    });
    const r = await captureFlow(() =>
      actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
    expect(testDb.select().from(children).where(eq(children.id, c.id)).get()).toBeUndefined();
  });
});

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

import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { children, invitations, memberships, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';
import { PASSWORD, setup } from './settings-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

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
    await testDb.insert(invitations).values([
      {
        code: 'BEBE-AAAAAA',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        usedAt: null,
        usedBy: null
      },
      {
        // Expired : should be excluded.
        code: 'BEBE-BBBBBB',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 86400_000),
        usedAt: null,
        usedBy: null
      },
      {
        // Used : should be excluded.
        code: 'BEBE-CCCCCC',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        usedAt: new Date(),
        usedBy: u.id
      }
    ]);

    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.members.length).toBe(1);
    expect(out.invitations.map((i) => i.code)).toEqual(['BEBE-AAAAAA']);
    expect(out.role).toBe('owner');
  });

  it('owners see every member email (administrative need)', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const c = await seedChild({ createdBy: owner.id, name: 'Bébé' });
    const ownerMembership = await seedMembership({
      userId: owner.id,
      childId: c.id,
      role: 'owner'
    });
    const peer = await seedUser({ email: 'peer@example.com' });
    await seedMembership({ userId: peer.id, childId: c.id, role: 'member' });

    const out = await load(
      makeRouteEvent({
        user: safeUser(owner),
        memberships: [ownerMembership],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );

    const byUserId = new Map(out.members.map((m) => [m.userId, m]));
    expect(byUserId.get(owner.id)?.email).toBe('owner@example.com');
    expect(byUserId.get(peer.id)?.email).toBe('peer@example.com');
  });

  it('non-owner members never see any co-parent email', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const c = await seedChild({ createdBy: owner.id, name: 'Bébé' });
    await seedMembership({ userId: owner.id, childId: c.id, role: 'owner' });
    const viewer = await seedUser({ email: 'viewer@example.com' });
    const viewerMembership = await seedMembership({
      userId: viewer.id,
      childId: c.id,
      role: 'member'
    });
    const peer = await seedUser({ email: 'peer@example.com' });
    await seedMembership({ userId: peer.id, childId: c.id, role: 'member' });

    const out = await load(
      makeRouteEvent({
        user: safeUser(viewer),
        memberships: [viewerMembership],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );

    expect(out.role).toBe('member');
    for (const m of out.members) {
      expect(m.email).toBeNull();
      expect(m.displayName).toBeTruthy();
    }
  });
});

describe('settings updateChild action', () => {
  it('owner-only : fails for member', async () => {
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
    const fresh = (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0];
    expect(fresh?.name).toBe('Lulu');
    expect(fresh?.birthDate).toBe('2024-02-15');
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
    const c = await seedChild({ createdBy: owner.id });
    await seedMembership({ userId: owner.id, childId: c.id, role: 'owner' });
    const m = await seedMembership({ userId: me.id, childId: c.id, role: 'member' });
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
    const remaining = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
    expect(remaining.length).toBe(0);
  });
});

describe('settings deleteChild action', () => {
  it('fails when confirmText mismatches', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Wrong', currentPassword: PASSWORD }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('redirects when child no longer exists', async () => {
    const { u, c, m } = await setup();
    await testDb.delete(children).where(eq(children.id, c.id));
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé', currentPassword: PASSWORD }
    });
    const r = await captureFlow(() =>
      actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
  });

  it('fails when currentPassword is missing', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé' }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
    expect(
      (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0]
    ).toBeDefined();
  });

  it('redirects to /login when owner row is gone (race)', async () => {
    const { u, c, m } = await setup();
    await testDb.delete(memberships).where(eq(memberships.userId, u.id));
    await testDb.insert(memberships).values({
      userId: u.id,
      childId: c.id,
      role: 'owner',
      createdAt: new Date()
    });
    // Delete the owner row AFTER the membership re-insert so requireOwnership
    // (which reads from locals.memberships) still passes, but the password
    // re-fetch from the users table comes back empty.
    await testDb.delete(users).where(eq(users.id, u.id));
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé', currentPassword: PASSWORD }
    });
    const r = await captureFlow(() =>
      actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('fails when currentPassword is wrong', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé', currentPassword: 'wrong-current' }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
    expect(
      (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0]
    ).toBeDefined();
  });

  it('deletes the child and redirects /', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé', currentPassword: PASSWORD }
    });
    const r = await captureFlow(() =>
      actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
    expect(
      (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0]
    ).toBeUndefined();
  });

  it('rate-limits brute-force attempts on the currentPassword field', async () => {
    const { u, c, m } = await setup();
    // 5 wrong-password attempts allowed, the 6th gets 429.
    for (let i = 0; i < 5; i++) {
      const event = makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) },
        formData: { confirmText: 'Bébé', currentPassword: 'wrong' }
      });
      await actions.deleteChild!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
      );
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmText: 'Bébé', currentPassword: 'wrong' }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(429);
    expect(
      (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0]
    ).toBeDefined();
  });
});

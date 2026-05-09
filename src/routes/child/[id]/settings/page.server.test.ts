import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
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

import { hashPassword } from '$lib/server/auth';
import { children, invitations, memberships } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

const PASSWORD = 'current-password-12';
let realHash: string;

beforeAll(async () => {
  // Hash once per file (~50 ms) and reuse across every setup() call. The
  // deleteChild action verifies the password via argon2id, so the seeded
  // user must hold a real hash, not a placeholder.
  realHash = await hashPassword(PASSWORD);
});

beforeEach(async () => {
  await resetTestDb();
});

async function setup(opts: { role?: 'owner' | 'member' } = {}) {
  const u = await seedUser({ passwordHash: realHash });
  const c = await seedChild({ createdBy: u.id, name: 'Bébé' });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: opts.role ?? 'owner' });
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
        // Expired — should be excluded.
        code: 'BEBE-BBBBBB',
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 86400_000),
        usedAt: null,
        usedBy: null
      },
      {
        // Used — should be excluded.
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
    const fresh = (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0];
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
    const stored = (
      await testDb.select().from(invitations).where(eq(invitations.code, r.code)).limit(1)
    )[0];
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
    await testDb.insert(invitations).values({
      code: 'BEBE-ZZZZZZ',
      childId: c.id,
      createdBy: u.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { code: 'BEBE-ZZZZZZ' }
    });
    const r = (await actions.revokeInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.revokeInvitation>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const stored = (
      await testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ZZZZZZ')).limit(1)
    )[0];
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
    await seedMembership({ userId: other.id, childId: c.id, role: 'member' });
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
    const remaining = await testDb.select().from(memberships).where(eq(memberships.childId, c.id));
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
  it('fails when confirmName mismatches', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmName: 'Wrong', currentPassword: PASSWORD }
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
      formData: { confirmName: 'Bébé', currentPassword: PASSWORD }
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
      formData: { confirmName: 'Bébé' }
    });
    const r = (await actions.deleteChild!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteChild>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
    expect(
      (await testDb.select().from(children).where(eq(children.id, c.id)).limit(1))[0]
    ).toBeDefined();
  });

  it('fails when currentPassword is wrong', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { confirmName: 'Bébé', currentPassword: 'wrong-current' }
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
      formData: { confirmName: 'Bébé', currentPassword: PASSWORD }
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
});
